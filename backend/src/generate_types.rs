use std::fs;
use std::path::Path;
use ts_rs::TS;
use backend::models::*;
use backend::qr_handlers::*;
use backend::HealthResponse;

fn process_ts_content(content: &str) -> String {
    // Remove import statements and extra headers since we're consolidating everything into one file
    let lines: Vec<&str> = content.lines().collect();
    let mut processed_lines = Vec::new();
    
    for line in lines {
        // Skip import lines that reference other files (but keep export statements)
        if line.starts_with("import type") || line.starts_with("import ") {
            continue;
        }
        processed_lines.push(line);
    }
    
    processed_lines.join("\n")
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Generating TypeScript types from Rust structs...");

    // Create temporary directory for exports
    let temp_dir = std::env::temp_dir().join("ts_exports");
    fs::create_dir_all(&temp_dir)?;

    // Export all types to temporary directory - we need to export each annotated type
    MenuItem::export_all_to(&temp_dir)?;
    MenuSection::export_all_to(&temp_dir)?;
    Restaurant::export_all_to(&temp_dir)?;
    Table::export_all_to(&temp_dir)?;
    Order::export_all_to(&temp_dir)?;
    OrderItem::export_all_to(&temp_dir)?;
    PublicMenu::export_all_to(&temp_dir)?;
    PublicMenuSection::export_all_to(&temp_dir)?;
    PublicMenuItem::export_all_to(&temp_dir)?;
    PublicRestaurantInfo::export_all_to(&temp_dir)?;
    RestaurantMenu::export_all_to(&temp_dir)?;
    MenuSectionWithItems::export_all_to(&temp_dir)?;
    OrderResponse::export_all_to(&temp_dir)?;
    OrderItemResponse::export_all_to(&temp_dir)?;
    CreateOrderResponse::export_all_to(&temp_dir)?;
    AuthResponse::export_all_to(&temp_dir)?;
    UserResponse::export_all_to(&temp_dir)?;
    QrCodeResponse::export_all_to(&temp_dir)?;
    QrCodeImageResponse::export_all_to(&temp_dir)?;
    PrintSheetResponse::export_all_to(&temp_dir)?;
    HealthResponse::export_all_to(&temp_dir)?;

    // Read all generated files and process them
    let mut all_types = String::new();
    for entry in fs::read_dir(&temp_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "ts") {
            let content = fs::read_to_string(&path)?;
            
            // Process content to remove import statements since we're consolidating into one file
            let processed_content = process_ts_content(&content);
            all_types.push_str(&processed_content);
            all_types.push_str("\n\n");
        }
    }

    // Clean up temp directory
    fs::remove_dir_all(&temp_dir)?;

    // Ensure directories exist
    let admin_types_dir = "../adminapp/src/types";
    let menu_types_dir = "../menuapp/src/types";

    if let Err(_) = fs::metadata(admin_types_dir) {
        fs::create_dir_all(admin_types_dir)?;
    }

    if let Err(_) = fs::metadata(menu_types_dir) {
        fs::create_dir_all(menu_types_dir)?;
    }

    // Write to admin app
    let admin_path = Path::new(admin_types_dir).join("api.ts");
    fs::write(&admin_path, &all_types)?;
    println!("Generated TypeScript types for adminapp: {}", admin_path.display());

    // Write to menu app  
    let menu_path = Path::new(menu_types_dir).join("api.ts");
    fs::write(&menu_path, &all_types)?;
    println!("Generated TypeScript types for menuapp: {}", menu_path.display());

    println!("TypeScript type generation completed successfully!");
    Ok(())
}