import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { Person } from '../../people/entities/person.entity';

/**
 * Entity Address.
 *
 * Mapeia a tabela `address` no banco. Representa um endereço de uma Person.
 * Relacionamento N:1 — uma pessoa pode ter múltiplos endereços (ex: residência
 * e trabalho), mas cada endereço pertence a apenas uma pessoa.
 *
 * Endereços são criados quando o usuário completa o auto-cadastro no site (fluxo 2).
 * Pessoas registradas via caixa (fluxo 1) não têm endereço até completar o cadastro.
 */
@Entity()
export class Address {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 11 })
    cpf_pessoa: string;

    @ManyToOne(() => Person, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cpf_pessoa', referencedColumnName: 'cpf' })
    pessoa: Person;

    @Column({ type: 'varchar', length: 9 })
    cep: string;

    @Column({ type: 'varchar' })
    logradouro: string;

    @Column({ type: 'varchar' })
    numero: string;

    @Column({ type: 'varchar', nullable: true })
    complemento: string | null;

    @Column({ type: 'varchar' })
    bairro: string;

    @Column({ type: 'varchar' })
    cidade: string;

    @Column({ type: 'varchar', length: 2 })
    uf: string;
}
