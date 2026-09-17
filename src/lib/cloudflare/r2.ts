import 'server-only'

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const bucket = process.env.CLOUDFLARE_R2_BUCKET ?? 'prisma-spk-documents'

export const R2_MAX_FILE_SIZE = 50 * 1024 * 1024

function configurationError() {
  return new Error('Penyimpanan dokumen belum dikonfigurasi. Tambahkan kredensial Cloudflare R2 di environment aplikasi.')
}

export function isR2Configured() {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket)
}

function client() {
  if (!isR2Configured()) throw configurationError()

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  })
}

export function r2Bucket() {
  return bucket
}

export async function createUploadUrl(key: string, contentType: string) {
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: 10 * 60,
  })
}

export async function headR2Object(key: string) {
  return client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
}

export async function getR2Object(key: string, range?: string) {
  return client().send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }))
}

export async function deleteR2Object(key: string) {
  return client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
