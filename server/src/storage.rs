use aws_sdk_s3::config::{BehaviorVersion, Credentials, Region};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use chrono::Utc;
use uuid::Uuid;

pub fn build_object_key(kiosk_id: &str, vote_id: &Uuid) -> String {
    let date = Utc::now().format("%Y-%m-%d");
    format!("{kiosk_id}/{date}/{vote_id}.jpg")
}

#[derive(Clone)]
pub struct R2Storage {
    client: Client,
    bucket: String,
}

impl R2Storage {
    pub fn from_env() -> anyhow::Result<Self> {
        let account_id = std::env::var("R2_ACCOUNT_ID")?;
        let access_key_id = std::env::var("R2_ACCESS_KEY_ID")?;
        let secret_access_key = std::env::var("R2_SECRET_ACCESS_KEY")?;
        let bucket = std::env::var("R2_BUCKET")?;

        let credentials = Credentials::new(access_key_id, secret_access_key, None, None, "r2");
        let config = aws_sdk_s3::Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new("auto"))
            .endpoint_url(format!("https://{account_id}.r2.cloudflarestorage.com"))
            .credentials_provider(credentials)
            .build();

        Ok(Self {
            client: Client::from_conf(config),
            bucket,
        })
    }

    pub async fn upload_photo(&self, object_key: &str, bytes: &[u8]) -> anyhow::Result<()> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(object_key)
            .body(ByteStream::from(bytes.to_vec()))
            .content_type("image/jpeg")
            .send()
            .await?;
        Ok(())
    }

    pub async fn fetch_photo(&self, object_key: &str) -> anyhow::Result<Vec<u8>> {
        let output = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(object_key)
            .send()
            .await?;
        let bytes = output.body.collect().await?.into_bytes().to_vec();
        Ok(bytes)
    }
}
