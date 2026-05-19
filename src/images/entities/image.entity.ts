import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CatalogImage } from './catalog-image.entity';

@Entity()
export class Image {
  @PrimaryGeneratedColumn()
  idImagem: number;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descricao: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  localRenderizacao: string | null;

  @OneToMany(() => CatalogImage, (catalogImage) => catalogImage.image)
  catalogImages: CatalogImage[];
}
