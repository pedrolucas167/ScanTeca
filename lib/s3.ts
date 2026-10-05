import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "sa-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "scanteca-feed-images-343212497955-sa-east-1-an";

export async function uploadFeedImage(
  userId: string,
  postId: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const key = `feed/${userId}/${postId}/${Date.now()}.jpg`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000",
  });

  await s3Client.send(command);

  return `https://${BUCKET_NAME}.s3.sa-east-1.amazonaws.com/${key}`;
}

export async function deleteFeedImage(url: string | null): Promise<void> {
  if (!url) return;

  try {
    const key = url.split("/").slice(-3).join("/");
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.error("[s3] Error deleting feed image:", error);
  }
}
