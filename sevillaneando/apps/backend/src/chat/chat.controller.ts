import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { ThrottleUpload } from '../common/decorators/throttle-custom.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('upload')
  @UseGuards(FirebaseAuthGuard)
  @ThrottleUpload()
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Subir una imagen para el chat' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 201, description: 'Imagen subida correctamente', schema: { example: { imageUrl: 'https://res.cloudinary.com/...' } } })
  @ApiResponse({ status: 400, description: 'Archivo no proporcionado o formato no permitido' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Formato no permitido'), false);
        }
        return cb(null, true);
      },
    })
  )
  async uploadChatImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');

    const uploaded = await this.cloudinaryService.uploadImage(file.buffer, {
      folder: 'sevillaneando/chat-images',
      publicIdPrefix: 'chat',
    });

    return { imageUrl: uploaded.optimizedUrl };
  }
}
