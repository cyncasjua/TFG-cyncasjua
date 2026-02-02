# Guía de Estilo de Código - Sevillaneando

Convenciones simples para mantener código consistente y limpio.

## Reglas Básicas

- Indentación: 2 espacios
- Comillas: simples
- Punto y coma: siempre
- Longitud máxima: 100 caracteres
- Final de línea: Unix (LF)

**Final de línea Unix:**
Windows termina con `\r\n`, Unix con `\n`. Usamos Unix para que Git funcione igual en todos.

### Nombres

```typescript
// Variables y funciones: camelCase
const userName = 'Juan';
const getUserById = (id: number) => { };

// Constantes: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const API_URL = 'https://api.example.com';

// Clases e Interfaces: PascalCase
class UserService { }
interface UserResponse { }

// Archivos: kebab-case
user.service.ts
auth.guard.ts
create-event.dto.ts
```

### Formato

- **Indentación:** 2 espacios
- **Comillas:** simples `'texto'`
- **Punto y coma:** siempre
- **Longitud máxima:** 100 caracteres
- **Template strings:** backticks para interpolación

---

## TypeScript

- **Tipos siempre:** especificar tipos explícitos
- **No usar `any`:** usar tipos genéricos o `unknown` si es necesario
- **Nullabilidad:** indicar `| null` o `| undefined` cuando aplique

```typescript
// ✅ CORRECTO
const userId: number = 123;
const userName: string | null = getUserName();

function getUser(id: number): Promise<User> {
  return userService.findById(id);
}

// ❌ INCORRECTO
let data: any = {};
const user = getUserData();  // sin tipo de retorno
```

---

## NestJS (Backend)

### Estructura
```
src/
├── app.module.ts
├── main.ts
├── users/
│   ├── users.service.ts
│   ├── users.controller.ts
│   ├── users.module.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   └── entities/
│       └── user.entity.ts
```

### Servicios
```typescript
@Injectable()
export class UserService {
  async findById(id: number): Promise<User> {
    const user = await this.repository.findOne({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
```

### Controladores
```typescript
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  async getUserById(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.userService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.userService.create(dto);
  }
}
```

### DTOs
```typescript
import { IsString, IsEmail } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;
}
```

---

## React Native (Frontend)

### Componentes
```typescript
interface EventCardProps {
  title: string;
  onPress: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ title, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
};
```

### Hooks Personalizados
```typescript
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Uso
const MyComponent = () => {
  const { user } = useAuth();
  return <Text>{user?.name}</Text>;
};
```

### API Calls
```typescript
class ApiService {
  async getUser(id: number): Promise<User> {
    const { data } = await axios.get(`/users/${id}`);
    return data;
  }
}

export const apiService = new ApiService();
```

---

## Git y Commits

### Tipos de Commits

```bash
feat:     Nueva característica
fix:      Corrección de bug
docs:     Cambios en documentación
style:    Formato de código (sin cambios de lógica)
refactor: Refactorización de código
perf:     Mejoras de rendimiento
test:     Tests
chore:    Cambios en dependencias o configuración
```

### Ejemplos

```bash
git commit -m "feat: agregar autenticación con Firebase"
git commit -m "fix(users): corregir validación de email"
git commit -m "docs: actualizar README"
git commit -m "refactor(events): mejorar estructura"
```

## Herramientas

### ESLint - Detecta errores
```bash
npm run lint        # Validar
npm run lint:fix    # Validar y corregir
```

### Prettier - Formatea código
```bash
npm run format      # Formatear
npm run format:check  # Verificar formato
```

### TypeScript - Valida tipos
```bash
npm run type-check  # Verificar tipos
```

### Pre-commit hooks
- ESLint valida automáticamente antes de hacer commit
- Prettier formatea los archivos
- CommitLint valida el mensaje del commit
