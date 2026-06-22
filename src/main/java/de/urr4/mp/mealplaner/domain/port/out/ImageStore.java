package de.urr4.mp.mealplaner.domain.port.out;

/**
 * Port for image storage. The actual infrastructure (e.g. MinIO) is hidden behind this interface.
 * The domain only knows about byte arrays and content types; it never imports S3 or MinIO classes.
 */
public interface ImageStore {

    /**
     * Stores the image bytes under a generated unique key.
     *
     * @param data        raw image bytes
     * @param contentType MIME type, e.g. "image/jpeg"
     * @return the generated imageId that can be used to fetch or delete the image later
     */
    String store(byte[] data, String contentType);

    /**
     * Fetches the raw image bytes for the given imageId.
     *
     * @param imageId the id returned by {@link #store}
     * @return raw image bytes
     */
    byte[] fetch(String imageId);

    /**
     * Deletes the image with the given imageId.
     *
     * @param imageId the id returned by {@link #store}
     */
    void delete(String imageId);
}
