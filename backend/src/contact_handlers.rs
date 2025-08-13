use crate::models::{
    ContactResponse, ContactSubmission, ContactSubmissionRow, CreateContactRequest,
};
use actix_web::{web, HttpRequest, HttpResponse, Result};
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;

// Simple in-memory rate limiter
pub struct RateLimiter {
    requests: Mutex<HashMap<String, Vec<Instant>>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            requests: Mutex::new(HashMap::new()),
        }
    }

    pub fn check_rate_limit(&self, ip: &str, max_requests: usize, window: Duration) -> bool {
        let mut requests = self.requests.lock().unwrap();
        let now = Instant::now();

        // Get or create entry for this IP
        let ip_requests = requests.entry(ip.to_string()).or_insert_with(Vec::new);

        // Remove old requests outside the window
        ip_requests.retain(|&time| now.duration_since(time) < window);

        // Check if under limit
        if ip_requests.len() < max_requests {
            ip_requests.push(now);
            true
        } else {
            false
        }
    }
}

pub async fn submit_contact_form(
    pool: web::Data<Pool<Sqlite>>,
    rate_limiter: web::Data<RateLimiter>,
    req: web::Json<CreateContactRequest>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    // Extract IP address
    let ip_address = http_req
        .connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string();

    // Rate limiting: 5 requests per hour per IP
    if !rate_limiter.check_rate_limit(&ip_address, 5, Duration::from_secs(3600)) {
        return Ok(HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Too many requests. Please try again later."
        })));
    }

    // Extract user agent
    let user_agent = http_req
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Basic validation
    if req.name.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Name is required"
        })));
    }

    if req.email.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Email is required"
        })));
    }

    if req.message.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Message is required"
        })));
    }

    // Basic email validation
    if !req.email.contains('@') || !req.email.contains('.') {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid email format"
        })));
    }

    // Validate length limits
    if req.name.len() > 100 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Name must be less than 100 characters"
        })));
    }

    if req.email.len() > 255 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Email must be less than 255 characters"
        })));
    }

    if let Some(ref subject) = req.subject {
        if subject.len() > 200 {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Subject must be less than 200 characters"
            })));
        }
    }

    if req.message.len() > 2000 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Message must be less than 2000 characters"
        })));
    }

    let submission_id = Uuid::new_v4().to_string();
    
    // Pre-process the trimmed values to avoid lifetime issues
    let name_trimmed = req.name.trim();
    let email_trimmed = req.email.trim();
    let subject_trimmed = req.subject.as_ref().map(|s| s.trim());
    let message_trimmed = req.message.trim();
    let ip_address_opt = Some(ip_address.as_str());

    // Insert contact submission into database
    let result = sqlx::query!(
        "INSERT INTO contact_submissions (id, name, email, subject, message, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'new')",
        submission_id,
        name_trimmed,
        email_trimmed,
        subject_trimmed,
        message_trimmed,
        ip_address_opt,
        user_agent
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            // TODO: Send email notification here
            // For now, we just log it
            log::info!(
                "New contact form submission from {} ({}): {}",
                name_trimmed,
                email_trimmed,
                subject_trimmed.unwrap_or("No subject")
            );

            let response = ContactResponse {
                message: "Thank you for your message! We'll get back to you soon.".to_string(),
                submission_id,
            };

            Ok(HttpResponse::Created().json(response))
        }
        Err(e) => {
            log::error!("Database error creating contact submission: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to submit contact form. Please try again later."
            })))
        }
    }
}

pub async fn list_contact_submissions(
    pool: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse> {
    // Note: This is a simple implementation. In production, you'd want:
    // 1. Authentication/authorization to limit access
    // 2. Pagination
    // 3. Filtering by status, date range, etc.

    let submissions = sqlx::query_as::<_, ContactSubmissionRow>(
        "SELECT id, name, email, subject, message, ip_address, user_agent, status, created_at 
         FROM contact_submissions 
         ORDER BY created_at DESC 
         LIMIT 100"
    )
    .fetch_all(pool.get_ref())
    .await;

    match submissions {
        Ok(rows) => {
            let submissions: Vec<ContactSubmission> = rows
                .into_iter()
                .map(ContactSubmission::from)
                .collect();
            Ok(HttpResponse::Ok().json(submissions))
        }
        Err(e) => {
            log::error!("Database error fetching contact submissions: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch contact submissions"
            })))
        }
    }
}

pub async fn get_contact_submission(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let submission_id = path.into_inner();

    let submission = sqlx::query_as::<_, ContactSubmissionRow>(
        "SELECT id, name, email, subject, message, ip_address, user_agent, status, created_at 
         FROM contact_submissions 
         WHERE id = ?"
    )
    .bind(&submission_id)
    .fetch_optional(pool.get_ref())
    .await;

    match submission {
        Ok(Some(row)) => {
            let submission = ContactSubmission::from(row);
            Ok(HttpResponse::Ok().json(submission))
        }
        Ok(None) => Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Contact submission not found"
        }))),
        Err(e) => {
            log::error!("Database error fetching contact submission: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch contact submission"
            })))
        }
    }
}

pub async fn update_contact_submission_status(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    status_req: web::Json<serde_json::Value>,
) -> Result<HttpResponse> {
    let submission_id = path.into_inner();

    let status = match status_req.get("status").and_then(|s| s.as_str()) {
        Some(status) if ["new", "read", "responded"].contains(&status) => status,
        _ => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid status. Must be one of: new, read, responded"
            })));
        }
    };

    let result = sqlx::query!(
        "UPDATE contact_submissions SET status = ? WHERE id = ?",
        status,
        submission_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Contact submission not found"
                })))
            } else {
                Ok(HttpResponse::NoContent().finish())
            }
        }
        Err(e) => {
            log::error!("Database error updating contact submission status: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update contact submission status"
            })))
        }
    }
}