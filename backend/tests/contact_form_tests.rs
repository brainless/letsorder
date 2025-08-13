use actix_web::test;
use backend::create_app;
use serde_json::json;

mod common;
use common::test_app::create_test_app;

#[tokio::test]
async fn test_submit_contact_form_success() {
    let test_app = create_test_app().await;

    let app = test::init_service(create_app(
        test_app.pool.clone(),
        test_app.jwt_manager.clone(),
    ))
    .await;

    let contact_data = json!({
        "name": "John Doe",
        "email": "john@example.com",
        "subject": "Test Subject",
        "message": "This is a test message for the contact form."
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());

    let response_body: serde_json::Value = test::read_body_json(resp).await;
    assert!(response_body["submission_id"].is_string());
    assert_eq!(
        response_body["message"],
        "Thank you for your message! We'll get back to you soon."
    );

    // Verify the submission was saved to the database
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM contact_submissions")
        .fetch_one(&test_app.pool)
        .await
        .expect("Failed to count contact submissions");
    assert_eq!(count, 1);
}

#[tokio::test]
async fn test_submit_contact_form_validation_errors() {
    let test_app = create_test_app().await;

    let app = test::init_service(create_app(
        test_app.pool.clone(),
        test_app.jwt_manager.clone(),
    ))
    .await;

    // Test missing name
    let contact_data = json!({
        "name": "",
        "email": "john@example.com",
        "message": "Test message"
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);

    // Test missing email
    let contact_data = json!({
        "name": "John Doe",
        "email": "",
        "message": "Test message"
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);

    // Test invalid email format
    let contact_data = json!({
        "name": "John Doe",
        "email": "invalid-email",
        "message": "Test message"
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);

    // Test missing message
    let contact_data = json!({
        "name": "John Doe",
        "email": "john@example.com",
        "message": ""
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn test_submit_contact_form_length_validation() {
    let test_app = create_test_app().await;

    let app = test::init_service(create_app(
        test_app.pool.clone(),
        test_app.jwt_manager.clone(),
    ))
    .await;

    // Test name too long
    let long_name = "a".repeat(101);
    let contact_data = json!({
        "name": long_name,
        "email": "john@example.com",
        "message": "Test message"
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);

    // Test email too long
    let long_email = format!("{}@example.com", "a".repeat(250));
    let contact_data = json!({
        "name": "John Doe",
        "email": long_email,
        "message": "Test message"
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);

    // Test message too long
    let long_message = "a".repeat(2001);
    let contact_data = json!({
        "name": "John Doe",
        "email": "john@example.com",
        "message": long_message
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn test_contact_form_with_optional_subject() {
    let test_app = create_test_app().await;

    let app = test::init_service(create_app(
        test_app.pool.clone(),
        test_app.jwt_manager.clone(),
    ))
    .await;

    // Test without subject (should work)
    let contact_data = json!({
        "name": "John Doe",
        "email": "john@example.com",
        "message": "Test message without subject"
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // Test with subject (should also work)
    let contact_data = json!({
        "name": "Jane Doe",
        "email": "jane@example.com",
        "subject": "Important inquiry",
        "message": "Test message with subject"
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // Verify both submissions were saved
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM contact_submissions")
        .fetch_one(&test_app.pool)
        .await
        .expect("Failed to count contact submissions");
    assert_eq!(count, 2);
}

#[tokio::test]
async fn test_rate_limiting_basic() {
    let test_app = create_test_app().await;

    let app = test::init_service(create_app(
        test_app.pool.clone(),
        test_app.jwt_manager.clone(),
    ))
    .await;

    let contact_data = json!({
        "name": "John Doe",
        "email": "john@example.com",
        "message": "Test message"
    });

    // Submit multiple requests quickly (rate limiter allows 5 per hour)
    for i in 0..5 {
        let req = test::TestRequest::post()
            .uri("/contact")
            .set_json(&json!({
                "name": "John Doe",
                "email": format!("john{}@example.com", i),
                "message": "Test message"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success(), "Request {} should succeed", i);
    }

    // The 6th request should be rate limited
    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 429); // Too Many Requests
}

#[tokio::test]
async fn test_contact_form_data_persistence() {
    let test_app = create_test_app().await;

    let app = test::init_service(create_app(
        test_app.pool.clone(),
        test_app.jwt_manager.clone(),
    ))
    .await;

    let contact_data = json!({
        "name": "Test User",
        "email": "test@example.com",
        "subject": "Test Subject",
        "message": "This is a test message for data persistence."
    });

    let req = test::TestRequest::post()
        .uri("/contact")
        .set_json(&contact_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // Verify the data was saved correctly
    let submission = sqlx::query!(
        "SELECT name, email, subject, message, status FROM contact_submissions ORDER BY created_at DESC LIMIT 1"
    )
    .fetch_one(&test_app.pool)
    .await
    .expect("Failed to fetch contact submission");

    assert_eq!(submission.name, "Test User");
    assert_eq!(submission.email, "test@example.com");
    assert_eq!(submission.subject, Some("Test Subject".to_string()));
    assert_eq!(
        submission.message,
        "This is a test message for data persistence."
    );
    assert_eq!(submission.status, "new");
}
