use log::{error, info};
use resend_rs::{types::CreateEmailBaseOptions, Resend};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use ts_rs::TS;

#[derive(Debug, Clone)]
pub struct EmailService {
    client: Resend,
    from_email: String,
    template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum EmailType {
    EmailVerification,
    PasswordReset,
    AdminContactNotification,
    SupportTicket,
    SupportResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EmailRequest {
    pub to: String,
    pub email_type: EmailType,
    pub subject: String,
    pub template_data: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EmailResponse {
    pub success: bool,
    pub message: String,
    pub email_id: Option<String>,
}

impl EmailService {
    pub fn new(
        api_key: String,
        from_email: String,
        template_path: String,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Resend::new(&api_key);

        // Load email template
        let template = fs::read_to_string(template_path)
            .map_err(|e| format!("Failed to read email template: {}", e))?;

        Ok(EmailService {
            client,
            from_email,
            template,
        })
    }

    pub async fn send_email(
        &self,
        request: EmailRequest,
    ) -> Result<EmailResponse, Box<dyn std::error::Error>> {
        info!(
            "Sending {} email to {}",
            self.email_type_string(&request.email_type),
            request.to
        );

        // Generate email content from template
        let email_body = self.generate_email_content(&request)?;

        // Send email via Resend - use builder pattern
        let email_request = CreateEmailBaseOptions::new(
            self.from_email.clone(),
            vec![request.to.clone()],
            request.subject.clone(),
        )
        .with_text(&email_body);
        // HTML is None by default for text-only emails

        match self.client.emails.send(email_request).await {
            Ok(response) => {
                info!("Email sent successfully: {}", response.id);
                Ok(EmailResponse {
                    success: true,
                    message: "Email sent successfully".to_string(),
                    email_id: Some(response.id.to_string()),
                })
            }
            Err(err) => {
                error!("Email service error: {:?}", err);
                Ok(EmailResponse {
                    success: false,
                    message: format!("Failed to send email: {}", err),
                    email_id: None,
                })
            }
        }
    }

    fn generate_email_content(
        &self,
        request: &EmailRequest,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let mut content = self.template.clone();

        // Replace template placeholders with actual data
        for (key, value) in &request.template_data {
            let placeholder = format!("{{{{{}}}}}", key);
            content = content.replace(&placeholder, value);
        }

        // Add email type specific content
        content = content.replace(
            "{{email_type}}",
            &self.email_type_string(&request.email_type),
        );

        Ok(content)
    }

    fn email_type_string(&self, email_type: &EmailType) -> String {
        match email_type {
            EmailType::EmailVerification => "Email Verification".to_string(),
            EmailType::PasswordReset => "Password Reset".to_string(),
            EmailType::AdminContactNotification => "Contact Form Notification".to_string(),
            EmailType::SupportTicket => "Support Ticket".to_string(),
            EmailType::SupportResponse => "Support Response".to_string(),
        }
    }

    // Email type specific methods
    pub async fn send_email_verification(
        &self,
        to: String,
        verification_link: String,
        user_name: String,
    ) -> Result<EmailResponse, Box<dyn std::error::Error>> {
        let mut template_data = HashMap::new();
        template_data.insert("user_name".to_string(), user_name);
        template_data.insert("verification_link".to_string(), verification_link);
        template_data.insert(
            "action_text".to_string(),
            "Please verify your email address by clicking the link below:".to_string(),
        );

        let request = EmailRequest {
            to,
            email_type: EmailType::EmailVerification,
            subject: "Verify Your Email Address - LetsOrder".to_string(),
            template_data,
        };

        self.send_email(request).await
    }

    pub async fn send_password_reset(
        &self,
        to: String,
        reset_link: String,
        user_name: String,
    ) -> Result<EmailResponse, Box<dyn std::error::Error>> {
        let mut template_data = HashMap::new();
        template_data.insert("user_name".to_string(), user_name);
        template_data.insert("reset_link".to_string(), reset_link);
        template_data.insert(
            "action_text".to_string(),
            "Click the link below to reset your password:".to_string(),
        );

        let request = EmailRequest {
            to,
            email_type: EmailType::PasswordReset,
            subject: "Reset Your Password - LetsOrder".to_string(),
            template_data,
        };

        self.send_email(request).await
    }

    pub async fn send_contact_form_notification(
        &self,
        admin_email: String,
        submission_data: HashMap<String, String>,
    ) -> Result<EmailResponse, Box<dyn std::error::Error>> {
        let mut template_data = submission_data.clone();
        template_data.insert(
            "action_text".to_string(),
            "A new contact form submission has been received:".to_string(),
        );

        let request = EmailRequest {
            to: admin_email,
            email_type: EmailType::AdminContactNotification,
            subject: "New Contact Form Submission - LetsOrder".to_string(),
            template_data,
        };

        self.send_email(request).await
    }

    pub async fn send_support_ticket(
        &self,
        to: String,
        ticket_data: HashMap<String, String>,
    ) -> Result<EmailResponse, Box<dyn std::error::Error>> {
        let mut template_data = ticket_data.clone();
        template_data.insert(
            "action_text".to_string(),
            "Your support ticket has been created:".to_string(),
        );

        let request = EmailRequest {
            to,
            email_type: EmailType::SupportTicket,
            subject: "Support Ticket Created - LetsOrder".to_string(),
            template_data,
        };

        self.send_email(request).await
    }

    pub async fn send_support_response(
        &self,
        to: String,
        response_data: HashMap<String, String>,
    ) -> Result<EmailResponse, Box<dyn std::error::Error>> {
        let mut template_data = response_data.clone();
        template_data.insert(
            "action_text".to_string(),
            "You have received a response to your support ticket:".to_string(),
        );

        let request = EmailRequest {
            to,
            email_type: EmailType::SupportResponse,
            subject: "Support Ticket Response - LetsOrder".to_string(),
            template_data,
        };

        self.send_email(request).await
    }
}

// Error handling for email operations
#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct EmailError {
    pub error: String,
    pub details: Option<String>,
}

impl From<Box<dyn std::error::Error>> for EmailError {
    fn from(err: Box<dyn std::error::Error>) -> Self {
        EmailError {
            error: "Email service error".to_string(),
            details: Some(err.to_string()),
        }
    }
}
