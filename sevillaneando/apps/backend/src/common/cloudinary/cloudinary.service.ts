import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';

type UploadImageOptions = {
  folder: string;
  publicIdPrefix?: string;
};

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    this.isConfigured = Boolean(cloudName && apiKey && apiSecret);

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      return;
    }

    this.logger.warn(
      'Cloudinary no configurado: define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.'
    );
  }

  async uploadImage(fileBuffer: Buffer, options: UploadImageOptions) {
    if (!this.isConfigured) {
      throw new InternalServerErrorException(
        'Cloudinary no está configurado en el backend.'
      );
    }

    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      const publicId = options.publicIdPrefix
        ? `${options.publicIdPrefix}-${Date.now()}`
        : undefined;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          resource_type: 'image',
          public_id: publicId,
          overwrite: false,
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined
        ) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary no devolvió resultado'));
            return;
          }

          resolve(result);
        }
      );

      uploadStream.end(fileBuffer);
    });

    return {
      url: uploadResult.secure_url,
      optimizedUrl: cloudinary.url(uploadResult.public_id, {
        secure: true,
        fetch_format: 'auto',
        quality: 'auto:good',
      }),
      publicId: uploadResult.public_id,
    };
  }
}
