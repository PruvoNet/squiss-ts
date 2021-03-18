import {DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, S3ClientConfig} from '@aws-sdk/client-s3';
import {Readable} from 'stream';
import {
    DeleteObjectRequest,
    S3Facade,
    GetObjectRequest,
    GetObjectResponse,
    PutObjectRequest,
    buildLazyGetter, classGetter,
} from '@squiss/core';

const streamToString = (stream: Readable): Promise<string> => {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
}

class S3Impl implements S3Facade {
    constructor(private readonly client: S3Client) {
    }

    public async deleteObject(request: DeleteObjectRequest): Promise<void> {
        const command = new DeleteObjectCommand({
            ...request,
            Bucket: request.Bucket,
            Key: request.Key,
        });
        await this.client.send(command);
    }

    public async getObject(request: GetObjectRequest): Promise<GetObjectResponse> {
        const command = new GetObjectCommand({
            ...request,
            Bucket: request.Bucket,
            Key: request.Key,
        });
        const response = await this.client.send(command);
        const body = response.Body;
        if (!body) {
            throw new Error(`missing body in s3 object ${request.Bucket}/${request.Key}`);
        }
        if (!(body instanceof Readable)) {
            throw new Error(`s3 object ${request.Bucket}/${request.Key} was not returned as a stream`);

        }
        const bodyStr = await streamToString(body);
        return {
            Body: bodyStr,
        };
    }

    public async putObject(request: PutObjectRequest): Promise<void> {
        const command = new PutObjectCommand({
            ...request,
            Bucket: request.Bucket,
            Key: request.Key,
            Body: request.Body,
            ContentLength: request.ContentLength,
        });
        await this.client.send(command);
    }
}


export const buildS3FacadeLazyGetter = (configuration: S3ClientConfig, client?: S3Client | typeof S3Client) => {
    return buildLazyGetter<S3Facade>(() => {
        const instance = classGetter<S3Client, S3ClientConfig>(S3Client, configuration, client);
        return new S3Impl(instance);
    })
}
