import { Person } from '../entities/person.entity';

/**
 * Projeção de Person sem o campo `senha`.
 *
 * Toda resposta de endpoint que envolva Person deve serializar para este
 * tipo, garantindo que o hash da senha nunca vaze. O service expõe um helper
 * `stripPassword(person) → IPersonSafe` para isso.
 */
export type IPersonSafe = Omit<Person, 'senha'>;
