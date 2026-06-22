package de.urr4.mp.mealplaner.adapter.minio;

import de.urr4.mp.mealplaner.domain.port.out.ImageStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.util.UUID;

@Component
@ConditionalOnProperty(name = "storage.type", havingValue = "minio")
public class MinioImageAdapter implements ImageStore {

    private final S3Client s3Client;
    private final String bucket;

    public MinioImageAdapter(S3Client s3Client, @Value("${minio.bucket}") String bucket) {
        this.s3Client = s3Client;
        this.bucket = bucket;
        ensureBucketExists();
    }

    @Override
    public String store(byte[] data, String contentType) {
        String imageId = UUID.randomUUID().toString();
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(imageId)
                        .contentType(contentType)
                        .contentLength((long) data.length)
                        .build(),
                RequestBody.fromBytes(data));
        return imageId;
    }

    @Override
    public byte[] fetch(String imageId) {
        ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(
                GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(imageId)
                        .build());
        return response.asByteArray();
    }

    @Override
    public void delete(String imageId) {
        s3Client.deleteObject(
                DeleteObjectRequest.builder()
                        .bucket(bucket)
                        .key(imageId)
                        .build());
    }

    private void ensureBucketExists() {
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (NoSuchBucketException e) {
            s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
        }
    }
}
