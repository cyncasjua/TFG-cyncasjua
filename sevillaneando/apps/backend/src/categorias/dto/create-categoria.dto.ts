import { IsString ,IsNotEmpty,Length} from 'class-validator';

export class CreateCategoriaDTO {

    @IsString()
    @IsNotEmpty()
    @Length(3, 100)
    nombre: string;
    
    @IsString()
    @IsNotEmpty()
    @Length(3, 500)
    descripcion: string;
}