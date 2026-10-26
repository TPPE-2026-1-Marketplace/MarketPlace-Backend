import { UpdateReviewSchema } from './update-review.dto';

describe('UpdateReviewSchema', () => {
  it('rejeita corpo vazio (nota e/ou comentário são obrigatórios)', () => {
    expect(() => UpdateReviewSchema.parse({})).toThrow(
      'Informe a nota e/ou o comentário a alterar',
    );
  });

  it.each([
    ['só nota', { nota: 4 }, true],
    ['só comentário', { comentario: 'Mudei de ideia' }, true],
    ['nota e comentário', { nota: 1, comentario: 'Piorou' }, true],
    ['comentário vazio (limpa o texto)', { comentario: '' }, true],
    ['nota 0', { nota: 0 }, false],
    ['nota 6', { nota: 6 }, false],
    ['nota decimal', { nota: 4.5 }, false],
    ['comentário com 2001 caracteres', { comentario: 'a'.repeat(2001) }, false],
  ])('%s => válido=%s', (_descricao, payload, valid) => {
    const parse = () => UpdateReviewSchema.parse(payload);
    if (valid) {
      expect(parse).not.toThrow();
    } else {
      expect(parse).toThrow();
    }
  });

  it('descarta campos fora do schema (o produto vem da rota)', () => {
    expect(UpdateReviewSchema.parse({ nota: 3, idProduto: 99 })).toEqual({ nota: 3 });
  });
});
