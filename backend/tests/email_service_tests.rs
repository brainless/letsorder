use backend::email_service::{EmailService, EmailType, EmailRequest};
use std::collections::HashMap;
use tokio_test;

#[tokio_test::test]
async fn test_email_service_initialization() {
    // Test email service creation with basic config
    let result = EmailService::new(
        "test_api_key".to_string(),
        "test@example.com".to_string(),
        "./tests/fixtures/test_email_template.txt".to_string(),
    );
    
    // Should fail because template file doesn't exist
    assert!(result.is_err());
}

#[tokio_test::test]
async fn test_email_template_generation() {
    // Create a test template file
    std::fs::create_dir_all("./tests/fixtures").unwrap_or_default();
    std::fs::write(
        "./tests/fixtures/test_template.txt",
        "Hello {{user_name}},\n\n{{action_text}}\n\n{{verification_link}}{{reset_link}}\n\nBest regards,\nTest Team"
    ).expect("Failed to create test template");

    let email_service = EmailService::new(
        "test_api_key".to_string(),
        "test@example.com".to_string(),
        "./tests/fixtures/test_template.txt".to_string(),
    );
    
    assert!(email_service.is_ok());
    
    // Clean up test file
    let _ = std::fs::remove_file("./tests/fixtures/test_template.txt");
}

#[test]
fn test_email_request_serialization() {
    let mut template_data = HashMap::new();
    template_data.insert("user_name".to_string(), "John Doe".to_string());
    template_data.insert("action_text".to_string(), "Please verify your email".to_string());
    
    let email_request = EmailRequest {
        to: "user@example.com".to_string(),
        email_type: EmailType::EmailVerification,
        subject: "Verify Your Email".to_string(),
        template_data,
    };
    
    let serialized = serde_json::to_string(&email_request);
    assert!(serialized.is_ok());
    
    let deserialized: Result<EmailRequest, _> = serde_json::from_str(&serialized.unwrap());
    assert!(deserialized.is_ok());
    
    let deserialized_req = deserialized.unwrap();
    assert_eq!(deserialized_req.to, "user@example.com");
    assert_eq!(deserialized_req.subject, "Verify Your Email");
}

#[test] 
fn test_email_type_variants() {
    use backend::email_service::EmailType;
    
    // Test that all email types can be created
    let types = vec![
        EmailType::EmailVerification,
        EmailType::PasswordReset,
        EmailType::AdminContactNotification,
        EmailType::SupportTicket,
        EmailType::SupportResponse,
    ];
    
    // Test serialization/deserialization of email types
    for email_type in types {
        let serialized = serde_json::to_string(&email_type);
        assert!(serialized.is_ok());
        
        let deserialized: Result<EmailType, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
    }
}