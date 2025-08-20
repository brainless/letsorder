use crate::email_service::{EmailService, EmailType};
use crate::models::*;
use crate::Settings;
use actix_web::{web, HttpResponse, Result};
use chrono::{Duration, Utc};
use log::{error, info, warn};
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use uuid::Uuid;

pub async fn create_email_verification_token(
    pool: &Pool<Sqlite>,
    user_id: &str,
) -> Result<String, sqlx::Error> {
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::hours(24); // 24 hour expiry

    sqlx::query!(
        "INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        user_id,
        token,
        expires_at.naive_utc()
    )
    .execute(pool)
    .await?;

    Ok(token)
}

pub async fn verify_email_token(
    pool: web::Data<Pool<Sqlite>>,
    request: web::Json<EmailVerificationRequest>,
    settings: web::Data<Settings>,
) -> Result<HttpResponse> {
    let token = &request.token;

    // Find the token and check if it's valid
    let token_record = match sqlx::query_as!(
        EmailVerificationTokenRow,
        "SELECT * FROM email_verification_tokens WHERE token = ? AND used_at IS NULL AND expires_at > ?",
        token,
        Utc::now().naive_utc()
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(token_record)) => token_record,
        Ok(None) => {
            warn!("Invalid or expired email verification token: {}", token);
            return Ok(HttpResponse::BadRequest().json(EmailVerificationResponse {
                success: false,
                message: "Invalid or expired verification token".to_string(),
            }));
        }
        Err(e) => {
            error!("Database error during email verification: {}", e);
            return Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Mark the user as verified and the token as used
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            error!("Failed to start transaction: {}", e);
            return Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Update user as verified
    if let Err(e) = sqlx::query!(
        "UPDATE users SET email_verified = TRUE WHERE id = ?",
        token_record.user_id
    )
    .execute(&mut *tx)
    .await
    {
        error!("Failed to update user verification status: {}", e);
        let _ = tx.rollback().await;
        return Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
            success: false,
            message: "Internal server error".to_string(),
        }));
    }

    // Mark token as used
    if let Err(e) = sqlx::query!(
        "UPDATE email_verification_tokens SET used_at = ? WHERE token = ?",
        Utc::now().naive_utc(),
        token
    )
    .execute(&mut *tx)
    .await
    {
        error!("Failed to mark token as used: {}", e);
        let _ = tx.rollback().await;
        return Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
            success: false,
            message: "Internal server error".to_string(),
        }));
    }

    if let Err(e) = tx.commit().await {
        error!("Failed to commit transaction: {}", e);
        return Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
            success: false,
            message: "Internal server error".to_string(),
        }));
    }

    info!("Email verified successfully for user: {}", token_record.user_id);

    Ok(HttpResponse::Ok().json(EmailVerificationResponse {
        success: true,
        message: "Email verified successfully".to_string(),
    }))
}

pub async fn resend_verification_email(
    pool: web::Data<Pool<Sqlite>>,
    request: web::Json<ResendVerificationRequest>,
    settings: web::Data<Settings>,
) -> Result<HttpResponse> {
    if let Some(ref email_config) = settings.email {
        if !email_config.enabled {
            return Ok(HttpResponse::ServiceUnavailable().json(EmailVerificationResponse {
                success: false,
                message: "Email service is currently disabled".to_string(),
            }));
        }
    } else {
        return Ok(HttpResponse::ServiceUnavailable().json(EmailVerificationResponse {
            success: false,
            message: "Email service is not configured".to_string(),
        }));
    }

    let email = &request.email;

    // Check if user exists and is not already verified
    let user = match sqlx::query_as!(
        UserRow,
        "SELECT * FROM users WHERE email = ?",
        email
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            // Don't reveal whether email exists or not for security
            return Ok(HttpResponse::Ok().json(EmailVerificationResponse {
                success: true,
                message: "If the email exists, a verification email has been sent".to_string(),
            }));
        }
        Err(e) => {
            error!("Database error during user lookup: {}", e);
            return Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Check if user is already verified
    let is_verified = sqlx::query_scalar!(
        "SELECT email_verified FROM users WHERE id = ?",
        user.id
    )
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(false);

    if is_verified {
        return Ok(HttpResponse::BadRequest().json(EmailVerificationResponse {
            success: false,
            message: "Email is already verified".to_string(),
        }));
    }

    // Create new verification token
    let token = match create_email_verification_token(pool.get_ref(), &user.id).await {
        Ok(token) => token,
        Err(e) => {
            error!("Failed to create verification token: {}", e);
            return Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Send verification email
    let email_config = settings.email.as_ref().unwrap();
    let email_service = match EmailService::new(
        email_config.api_key.clone(),
        email_config.from_email.clone(),
        email_config.template_path.clone(),
    ) {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize email service: {}", e);
            return Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // TODO: Replace with actual frontend URL
    let verification_link = format!("https://admin.letsorder.app/verify-email?token={}", token);
    
    match email_service.send_email_verification(
        user.email.clone(),
        verification_link,
        user.email.clone(), // Using email as name since we don't have separate name field
    ).await {
        Ok(_) => {
            info!("Verification email sent to: {}", user.email);
            Ok(HttpResponse::Ok().json(EmailVerificationResponse {
                success: true,
                message: "Verification email sent successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to send verification email: {}", e);
            Ok(HttpResponse::InternalServerError().json(EmailVerificationResponse {
                success: false,
                message: "Failed to send verification email".to_string(),
            }))
        }
    }
}

pub async fn create_password_reset_token(
    pool: &Pool<Sqlite>,
    user_id: &str,
) -> Result<String, sqlx::Error> {
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::hours(2); // 2 hour expiry for password reset

    sqlx::query!(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        user_id,
        token,
        expires_at.naive_utc()
    )
    .execute(pool)
    .await?;

    Ok(token)
}

pub async fn request_password_reset(
    pool: web::Data<Pool<Sqlite>>,
    request: web::Json<PasswordResetRequest>,
    settings: web::Data<Settings>,
) -> Result<HttpResponse> {
    if let Some(ref email_config) = settings.email {
        if !email_config.enabled {
            return Ok(HttpResponse::ServiceUnavailable().json(PasswordResetResponse {
                success: false,
                message: "Email service is currently disabled".to_string(),
            }));
        }
    } else {
        return Ok(HttpResponse::ServiceUnavailable().json(PasswordResetResponse {
            success: false,
            message: "Email service is not configured".to_string(),
        }));
    }

    let email = &request.email;

    // Check if user exists
    let user = match sqlx::query_as!(
        UserRow,
        "SELECT * FROM users WHERE email = ?",
        email
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            // Don't reveal whether email exists or not for security
            return Ok(HttpResponse::Ok().json(PasswordResetResponse {
                success: true,
                message: "If the email exists, a password reset email has been sent".to_string(),
            }));
        }
        Err(e) => {
            error!("Database error during user lookup: {}", e);
            return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Create password reset token
    let token = match create_password_reset_token(pool.get_ref(), &user.id).await {
        Ok(token) => token,
        Err(e) => {
            error!("Failed to create password reset token: {}", e);
            return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Send password reset email
    let email_config = settings.email.as_ref().unwrap();
    let email_service = match EmailService::new(
        email_config.api_key.clone(),
        email_config.from_email.clone(),
        email_config.template_path.clone(),
    ) {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize email service: {}", e);
            return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // TODO: Replace with actual frontend URL
    let reset_link = format!("https://admin.letsorder.app/reset-password?token={}", token);
    
    match email_service.send_password_reset(
        user.email.clone(),
        reset_link,
        user.email.clone(), // Using email as name since we don't have separate name field
    ).await {
        Ok(_) => {
            info!("Password reset email sent to: {}", user.email);
            Ok(HttpResponse::Ok().json(PasswordResetResponse {
                success: true,
                message: "Password reset email sent successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to send password reset email: {}", e);
            Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
                success: false,
                message: "Failed to send password reset email".to_string(),
            }))
        }
    }
}

pub async fn confirm_password_reset(
    pool: web::Data<Pool<Sqlite>>,
    request: web::Json<PasswordResetConfirmRequest>,
) -> Result<HttpResponse> {
    let token = &request.token;
    let new_password = &request.new_password;

    // Find the token and check if it's valid
    let token_record = match sqlx::query_as!(
        PasswordResetTokenRow,
        "SELECT * FROM password_reset_tokens WHERE token = ? AND used_at IS NULL AND expires_at > ?",
        token,
        Utc::now().naive_utc()
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(token_record)) => token_record,
        Ok(None) => {
            warn!("Invalid or expired password reset token: {}", token);
            return Ok(HttpResponse::BadRequest().json(PasswordResetResponse {
                success: false,
                message: "Invalid or expired reset token".to_string(),
            }));
        }
        Err(e) => {
            error!("Database error during password reset: {}", e);
            return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Hash the new password
    let password_hash = match argon2::hash_encoded(
        new_password.as_bytes(),
        &rand::random::<[u8; 32]>(),
        &argon2::Config::default(),
    ) {
        Ok(hash) => hash,
        Err(e) => {
            error!("Failed to hash password: {}", e);
            return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Update password and mark token as used
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            error!("Failed to start transaction: {}", e);
            return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    // Update user password
    if let Err(e) = sqlx::query!(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        password_hash,
        token_record.user_id
    )
    .execute(&mut *tx)
    .await
    {
        error!("Failed to update user password: {}", e);
        let _ = tx.rollback().await;
        return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
            success: false,
            message: "Internal server error".to_string(),
        }));
    }

    // Mark token as used
    if let Err(e) = sqlx::query!(
        "UPDATE password_reset_tokens SET used_at = ? WHERE token = ?",
        Utc::now().naive_utc(),
        token
    )
    .execute(&mut *tx)
    .await
    {
        error!("Failed to mark token as used: {}", e);
        let _ = tx.rollback().await;
        return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
            success: false,
            message: "Internal server error".to_string(),
        }));
    }

    if let Err(e) = tx.commit().await {
        error!("Failed to commit transaction: {}", e);
        return Ok(HttpResponse::InternalServerError().json(PasswordResetResponse {
            success: false,
            message: "Internal server error".to_string(),
        }));
    }

    info!("Password reset successfully for user: {}", token_record.user_id);

    Ok(HttpResponse::Ok().json(PasswordResetResponse {
        success: true,
        message: "Password reset successfully".to_string(),
    }))
}

// Support ticket handling
pub async fn send_support_ticket(
    pool: web::Data<Pool<Sqlite>>,
    settings: web::Data<Settings>,
    request: web::Json<CreateSupportTicketRequest>,
) -> Result<HttpResponse> {
    if let Some(ref email_config) = settings.email {
        if !email_config.enabled {
            return Ok(HttpResponse::ServiceUnavailable().json(SupportTicketResponse {
                success: false,
                message: "Email service is currently disabled".to_string(),
                ticket_id: None,
            }));
        }
    } else {
        return Ok(HttpResponse::ServiceUnavailable().json(SupportTicketResponse {
            success: false,
            message: "Email service is not configured".to_string(),
            ticket_id: None,
        }));
    }

    // Create support ticket record (this would typically be stored in database)
    let ticket_id = Uuid::new_v4().to_string();
    
    // TODO: Store support ticket in database
    info!("Support ticket created: {} from {}", ticket_id, request.email);

    // Send support ticket confirmation email
    let email_config = settings.email.as_ref().unwrap();
    let email_service = match EmailService::new(
        email_config.api_key.clone(),
        email_config.from_email.clone(),
        email_config.template_path.clone(),
    ) {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize email service: {}", e);
            return Ok(HttpResponse::InternalServerError().json(SupportTicketResponse {
                success: false,
                message: "Internal server error".to_string(),
                ticket_id: None,
            }));
        }
    };

    let mut ticket_data = HashMap::new();
    ticket_data.insert("user_name".to_string(), request.name.clone());
    ticket_data.insert("user_email".to_string(), request.email.clone());
    ticket_data.insert("subject".to_string(), request.subject.clone());
    ticket_data.insert("message".to_string(), request.message.clone());
    ticket_data.insert("ticket_id".to_string(), ticket_id.clone());

    // Send confirmation email to user
    match email_service.send_support_ticket(
        request.email.clone(),
        ticket_data.clone(),
    ).await {
        Ok(_) => {
            // Also send notification to admin
            let mut admin_data = ticket_data.clone();
            admin_data.insert("action_text".to_string(), "New support ticket received:".to_string());
            
            let _ = email_service.send_contact_form_notification(
                email_config.admin_email.clone(),
                admin_data,
            ).await;

            info!("Support ticket email sent to: {} (ID: {})", request.email, ticket_id);
            Ok(HttpResponse::Ok().json(SupportTicketResponse {
                success: true,
                message: "Support ticket created successfully. You will receive a confirmation email.".to_string(),
                ticket_id: Some(ticket_id),
            }))
        }
        Err(e) => {
            error!("Failed to send support ticket email: {}", e);
            Ok(HttpResponse::InternalServerError().json(SupportTicketResponse {
                success: false,
                message: "Failed to send support ticket email".to_string(),
                ticket_id: None,
            }))
        }
    }
}

pub async fn send_support_response(
    settings: web::Data<Settings>,
    request: web::Json<SendSupportResponseRequest>,
) -> Result<HttpResponse> {
    if let Some(ref email_config) = settings.email {
        if !email_config.enabled {
            return Ok(HttpResponse::ServiceUnavailable().json(SupportResponseEmailResponse {
                success: false,
                message: "Email service is currently disabled".to_string(),
            }));
        }
    } else {
        return Ok(HttpResponse::ServiceUnavailable().json(SupportResponseEmailResponse {
            success: false,
            message: "Email service is not configured".to_string(),
        }));
    }

    let email_config = settings.email.as_ref().unwrap();
    let email_service = match EmailService::new(
        email_config.api_key.clone(),
        email_config.from_email.clone(),
        email_config.template_path.clone(),
    ) {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize email service: {}", e);
            return Ok(HttpResponse::InternalServerError().json(SupportResponseEmailResponse {
                success: false,
                message: "Internal server error".to_string(),
            }));
        }
    };

    let mut response_data = HashMap::new();
    response_data.insert("user_name".to_string(), request.user_name.clone());
    response_data.insert("ticket_id".to_string(), request.ticket_id.clone());
    response_data.insert("response_content".to_string(), request.response.clone());

    match email_service.send_support_response(
        request.user_email.clone(),
        response_data,
    ).await {
        Ok(_) => {
            info!("Support response email sent to: {} for ticket: {}", request.user_email, request.ticket_id);
            Ok(HttpResponse::Ok().json(SupportResponseEmailResponse {
                success: true,
                message: "Support response sent successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to send support response email: {}", e);
            Ok(HttpResponse::InternalServerError().json(SupportResponseEmailResponse {
                success: false,
                message: "Failed to send support response email".to_string(),
            }))
        }
    }
}