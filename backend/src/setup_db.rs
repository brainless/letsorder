use sqlx::{Pool, Sqlite};

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    let pool = sqlx::SqlitePool::connect("sqlite:./letsorder.db").await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    println!("Database setup complete");
    Ok(())
}
