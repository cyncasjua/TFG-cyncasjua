import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsEndDateAfterStartDate(
  startDateProperty: string,
  validationOptions?: ValidationOptions
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEndDateAfterStartDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [startDateProperty],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];
          if (!value || !relatedValue) return true;
          return new Date(String(value)) > new Date(String(relatedValue));
        },
        defaultMessage() {
          return 'La fecha de fin debe ser posterior a la fecha de inicio.';
        },
      },
    });
  };
}
