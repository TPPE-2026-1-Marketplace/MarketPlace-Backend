-- Seed de desenvolvimento (issue #228).
--
-- Popula o banco local com um usuário por perfil, catálogo, estoque, cupons,
-- avaliações, metas e pedidos espalhados pelos últimos 6 meses, para validar o
-- frontend (loja, PDV e painel administrativo).
--
-- Uso: `make db-seed` (aplica sem apagar nada) ou `make db-seed-reset` (recria o
-- banco e aplica). Requer a API no ar ao menos uma vez, porque o schema vem do
-- `synchronize` do TypeORM.
--
-- Idempotente: pode rodar várias vezes. Produtos e categorias são achados pelo
-- SKU e pelo nome; os demais registros com ID fixo ficam na faixa 9000, para não
-- colidir com dados criados pela aplicação ou pelo `make demo`. Os usuários do
-- seed têm nome e senha redefinidos a cada execução.
--
-- Credenciais (somente desenvolvimento):
--   administrador  admin@demo.com           admin123
--   gerente        gerente@dkfashion.dev    gerente123
--   vendedor       vendedor@dkfashion.dev   vendedor123
--   caixa          caixa@dkfashion.dev      caixa123
--   cliente        cliente@dkfashion.dev    cliente123
--
-- Os CPFs são válidos (passam no dígito verificador) e não se repetem nos testes
-- de integração. O admin usa o mesmo CPF e e-mail do `make demo`.

BEGIN;

-- Usuários --------------------------------------------------------------------

INSERT INTO person (cpf, nome, email, telefone, senha)
VALUES
  ('00000000000', 'Admin Demo', 'admin@demo.com', '11999990000', '$2b$10$xuOiV7B/kqeO6psmP2ue3uu6oPJYK.sZ2b0GK1H6klUdPLN6INxm6'),
  ('39337997240', 'Cliente Teste', 'cliente@dkfashion.dev', '11999990001', '$2b$10$4pr0pp5hYwVQbUVjGEATa.aTsTt5jtZzAB32r8yjHQ959XXeUut0W'),
  ('19246459636', 'Gerente Teste', 'gerente@dkfashion.dev', '11999990002', '$2b$10$zkKmpaDocuih3mgirF1QLeqed3BFDG.413Ziiwn2VPNpceoDP6A1W'),
  ('93919986741', 'Vendedor Teste', 'vendedor@dkfashion.dev', '11999990003', '$2b$10$FaRRRZFueabapfmS3SQFB.jyu666QueBn0Aw8qq1MCfbNF2Lv10H.'),
  ('19954963677', 'Caixa Teste', 'caixa@dkfashion.dev', '11999990004', '$2b$10$cNDSTt3kSB7gTG7a9fjDlewkmGLlDoA7/iW39xM1wBF8m/IuN3F1u')
ON CONFLICT (cpf) DO UPDATE SET nome = EXCLUDED.nome, telefone = EXCLUDED.telefone, senha = EXCLUDED.senha;

INSERT INTO employee (cpf, ativo, role_perfil, taxa_comissao, meta_vendas, codigo_funcionario)
VALUES
  ('00000000000', true, 'administrador', 0.0250, NULL, NULL),
  ('19246459636', true, 'gerente', 0.0500, 25000.00, 'GER900'),
  ('93919986741', true, 'vendedor', 0.0350, 12000.00, 'VEN900'),
  ('19954963677', true, 'caixa', 0.0200, NULL, 'CX900')
ON CONFLICT (cpf) DO UPDATE SET ativo = true, role_perfil = EXCLUDED.role_perfil;

INSERT INTO address (id, cpf_pessoa, cep, logradouro, numero, complemento, bairro, cidade, uf)
VALUES
  (9001, '39337997240', '01310-100', 'Avenida Paulista', '1000', 'Apto 101', 'Bela Vista', 'São Paulo', 'SP')
ON CONFLICT DO NOTHING;

-- Catálogo --------------------------------------------------------------------

-- Produtos e categorias são ligados pelas chaves naturais (SKU e nome), e não
-- por IDs fixos: assim o seed convive com produtos criados pela aplicação.
INSERT INTO category (nome)
SELECT v.nome
FROM (VALUES ('Vestidos'), ('Blusas'), ('Calças'), ('Festa')) AS v(nome)
WHERE NOT EXISTS (SELECT 1 FROM category c WHERE c.nome = v.nome);

INSERT INTO product (
  titulo, descricao, destaque, qual_medida, material, composicao, silhueta, tags, preco_base, sku, media_avaliacao, total_avaliacoes
)
VALUES
  ('Vestido Midi Floral', 'Vestido leve para uso casual, com caimento solto e estampa floral.', true, 'Modelagem padrão', 'Viscose', '100% viscose', 'Midi', 'floral,casual,verao', 189.90, 'VEST-MIDI-FLORAL', 4.50, 2),
  ('Blusa Canelada Off White', 'Blusa básica canelada com manga curta.', true, 'Modelagem ajustada', 'Malha canelada', '96% algodão, 4% elastano', 'Slim', 'basica,canelada', 79.90, 'BLUSA-CANELADA-OFF', 5.00, 1),
  ('Calça Alfaiataria Preta', 'Calça de alfaiataria com corte reto para trabalho e eventos.', false, 'Cintura alta', 'Poliéster', '92% poliéster, 8% elastano', 'Reta', 'alfaiataria,social', 159.90, 'CALCA-ALFAIATARIA-PT', 0.00, 0),
  ('Princesa Rosé', 'Vestido longo de festa com saia ampla.', true, 'Modelagem padrão', 'Tule', '100% poliéster', 'Princesa', 'festa,longo', 899.90, 'DK-009', 0.00, 0),
  ('Longo Bordô', 'Vestido longo bordô com fenda lateral.', false, 'Modelagem padrão', 'Crepe', '97% poliéster, 3% elastano', 'Sereia', 'festa,longo', 599.00, 'DK-008', 0.00, 0),
  ('Midi Cetim', 'Vestido midi de cetim com alça fina.', false, 'Modelagem padrão', 'Cetim', '100% poliéster', 'Midi', 'festa,midi', 480.00, 'DK-012', 0.00, 0),
  -- Produto sem variantes: aparece no estoque como "Sem variantes cadastradas".
  ('Saia Plissada (rascunho)', 'Produto em cadastro, ainda sem variantes.', false, NULL, NULL, NULL, NULL, NULL, 219.90, 'DK-015', 0.00, 0)
ON CONFLICT DO NOTHING;

INSERT INTO product_category (product_id, category_id)
SELECT p.id_produto, (SELECT MIN(c.id_categoria) FROM category c WHERE c.nome = v.categoria)
FROM (
  VALUES
    ('VEST-MIDI-FLORAL', 'Vestidos'),
    ('BLUSA-CANELADA-OFF', 'Blusas'),
    ('CALCA-ALFAIATARIA-PT', 'Calças'),
    ('DK-009', 'Vestidos'),
    ('DK-009', 'Festa'),
    ('DK-008', 'Vestidos'),
    ('DK-008', 'Festa'),
    ('DK-012', 'Vestidos'),
    ('DK-012', 'Festa'),
    ('DK-015', 'Vestidos')
) AS v(sku, categoria)
JOIN product p ON p.sku = v.sku
ON CONFLICT DO NOTHING;

INSERT INTO product_variant (codigo_sku, preco_variante, ativo, cor, tamanho, medidas, id_produto)
SELECT v.codigo_sku, v.preco, true, v.cor, v.tamanho, v.medidas::jsonb, p.id_produto
FROM (
  VALUES
    ('VEST-MIDI-FLORAL-P', 'VEST-MIDI-FLORAL', 189.90, 'Azul Floral', 'P', '{"busto":88,"cintura":72,"quadril":96,"comprimento":118}'),
    ('VEST-MIDI-FLORAL-M', 'VEST-MIDI-FLORAL', 189.90, 'Azul Floral', 'M', '{"busto":94,"cintura":78,"quadril":102,"comprimento":120}'),
    ('BLUSA-CANELADA-OFF-P', 'BLUSA-CANELADA-OFF', 79.90, 'Off White', 'P', '{"busto":84,"comprimento":56}'),
    ('BLUSA-CANELADA-OFF-M', 'BLUSA-CANELADA-OFF', 79.90, 'Off White', 'M', '{"busto":90,"comprimento":58}'),
    ('CALCA-ALFAIATARIA-PT-38', 'CALCA-ALFAIATARIA-PT', 159.90, 'Preta', '38', '{"cintura":74,"quadril":100,"comprimento":104}'),
    ('CALCA-ALFAIATARIA-PT-40', 'CALCA-ALFAIATARIA-PT', 159.90, 'Preta', '40', '{"cintura":78,"quadril":104,"comprimento":105}'),
    ('DK-009-RO-P', 'DK-009', 899.90, 'Rosa', 'P', NULL),
    ('DK-009-RO-M', 'DK-009', 899.90, 'Rosa', 'M', NULL),
    ('DK-008-BO-G', 'DK-008', 599.00, 'Bordô', 'G', NULL),
    ('DK-008-BO-M', 'DK-008', 599.00, 'Bordô', 'M', NULL),
    ('DK-012-PR-P', 'DK-012', 480.00, 'Preto', 'P', NULL),
    ('DK-012-PR-M', 'DK-012', 480.00, 'Preto', 'M', NULL)
) AS v(codigo_sku, sku_produto, preco, cor, tamanho, medidas)
JOIN product p ON p.sku = v.sku_produto
ON CONFLICT DO NOTHING;

-- Estoque variado: disponível (> 5), baixo (1 a 5) e zerado.
INSERT INTO stock (codigo_sku, qtd_online, qtd_loja_fisica)
VALUES
  ('VEST-MIDI-FLORAL-P', 8, 2),
  ('VEST-MIDI-FLORAL-M', 5, 1),
  ('BLUSA-CANELADA-OFF-P', 12, 4),
  ('BLUSA-CANELADA-OFF-M', 9, 3),
  ('CALCA-ALFAIATARIA-PT-38', 3, 1),
  ('CALCA-ALFAIATARIA-PT-40', 0, 2),
  ('DK-009-RO-P', 6, 3),
  ('DK-009-RO-M', 2, 4),
  ('DK-008-BO-G', 0, 3),
  ('DK-008-BO-M', 0, 0),
  ('DK-012-PR-P', 8, 2),
  ('DK-012-PR-M', 14, 6)
ON CONFLICT DO NOTHING;

INSERT INTO image (id_imagem, url, ordem, descricao, local_renderizacao)
VALUES
  (9001, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80', 0, 'Vestido floral frente', 'catalogo'),
  (9002, 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80', 1, 'Vestido floral detalhe', 'catalogo'),
  (9003, 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=900&q=80', 0, 'Blusa canelada frente', 'catalogo'),
  (9004, 'https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=900&q=80', 0, 'Calça alfaiataria frente', 'catalogo')
ON CONFLICT DO NOTHING;

INSERT INTO catalog_image (id_imagem, codigo_sku, ordem_no_catalogo)
VALUES
  (9001, 'VEST-MIDI-FLORAL-P', 0),
  (9002, 'VEST-MIDI-FLORAL-P', 1),
  (9001, 'VEST-MIDI-FLORAL-M', 0),
  (9002, 'VEST-MIDI-FLORAL-M', 1),
  (9003, 'BLUSA-CANELADA-OFF-P', 0),
  (9003, 'BLUSA-CANELADA-OFF-M', 0),
  (9004, 'CALCA-ALFAIATARIA-PT-38', 0),
  (9004, 'CALCA-ALFAIATARIA-PT-40', 0)
ON CONFLICT DO NOTHING;

-- Cupons e avaliações ---------------------------------------------------------

INSERT INTO coupon (
  numero_do_cupom, tipo_cupom, valor_desconto, ativo, data_inicio, data_fim, uso_maximo, nome_influenciador, usos_atuais
)
VALUES
  ('BEMVINDA10', 'porcentagem', 10.00, true, NOW() - INTERVAL '30 days', NOW() + INTERVAL '180 days', 500, NULL, 0),
  ('ANA15', 'porcentagem', 15.00, true, NOW() - INTERVAL '10 days', NOW() + INTERVAL '90 days', 100, 'Ana Influencer', 3),
  ('LOOK20', 'fixo', 20.00, true, NOW() - INTERVAL '5 days', NOW() + INTERVAL '60 days', 50, NULL, 1)
ON CONFLICT DO NOTHING;

INSERT INTO coupon_product (coupon_id, product_id)
SELECT v.cupom, p.id_produto
FROM (VALUES ('ANA15', 'VEST-MIDI-FLORAL'), ('LOOK20', 'BLUSA-CANELADA-OFF')) AS v(cupom, sku)
JOIN product p ON p.sku = v.sku
ON CONFLICT DO NOTHING;

INSERT INTO review (cpf_cliente, id_produto, nota, comentario, data_avaliacao)
SELECT v.cpf, p.id_produto, v.nota, v.comentario, NOW() - v.dias * INTERVAL '1 day'
FROM (
  VALUES
    ('39337997240', 'VEST-MIDI-FLORAL', 5, 'Vestido muito bonito e vestiu super bem.', 7),
    ('19246459636', 'VEST-MIDI-FLORAL', 4, 'Tecido bom e ótimo acabamento.', 3),
    ('39337997240', 'BLUSA-CANELADA-OFF', 5, 'Blusa básica excelente para o dia a dia.', 2)
) AS v(cpf, sku, nota, comentario, dias)
JOIN product p ON p.sku = v.sku
ON CONFLICT DO NOTHING;

-- Metas -----------------------------------------------------------------------

-- Meta coletiva (cpf_funcionario NULL) e individual do vendedor no mês atual.
INSERT INTO sales_goal (id_goal, cpf_funcionario, mes, ano, valor_meta, valor_bonus)
VALUES
  (9001, NULL, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(YEAR FROM CURRENT_DATE)::int, 50000.00, 0.0100),
  (9002, '93919986741', EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(YEAR FROM CURRENT_DATE)::int, 12000.00, 0.0150)
ON CONFLICT DO NOTHING;

-- Pedidos ---------------------------------------------------------------------

-- Datas relativas a NOW(): o seed não envelhece. Cobre todos os status, as duas
-- modalidades, cliente cadastrado e clientes avulsos (PDV), nos últimos 6 meses.
INSERT INTO orders (
  id_pedido, id_usuario, id_cupom, data_pedido, status, subtotal, valor_frete, valor_total, tipo_retirada,
  codigo_verificacao_retirada, id_funcionario, codigo_rastreamento, cliente_nome_avulso, cliente_cpf_avulso
)
VALUES
  (9001, '39337997240', 'BEMVINDA10', NOW() - INTERVAL '4 days', 'paid', 269.80, 19.90, 262.72, 'entrega', NULL, NULL, NULL, NULL, NULL),
  (9002, '39337997240', NULL, NOW() - INTERVAL '1 day', 'pending', 159.90, 0.00, 159.90, 'loja', 'RTA123', '19954963677', NULL, NULL, NULL),
  (9003, '39337997240', 'ANA15', NOW() - INTERVAL '12 days', 'delivered', 189.90, 15.00, 176.42, 'entrega', NULL, NULL, 'BR987654321SP', NULL, NULL),
  (9004, NULL, NULL, NOW() - INTERVAL '2 hours', 'pending', 899.90, 0.00, 899.90, 'entrega', NULL, NULL, NULL, 'Marina Oliveira', '57451314464'),
  (9005, NULL, NULL, NOW() - INTERVAL '1 day', 'paid', 1249.00, 0.00, 1249.00, 'loja', 'RT1047', '19954963677', NULL, 'Camila Santos', '28455201746'),
  (9006, NULL, NULL, NOW() - INTERVAL '2 days', 'shipped', 599.00, 0.00, 599.00, 'entrega', NULL, NULL, 'BR555000111SP', 'Júlia Mendes', '01963144104'),
  (9007, NULL, NULL, NOW() - INTERVAL '3 days', 'paid', 480.00, 19.90, 499.90, 'entrega', NULL, NULL, NULL, 'Beatriz Costa', '74682489070'),
  (9008, NULL, NULL, NOW() - INTERVAL '5 days', 'pending', 960.00, 0.00, 960.00, 'loja', 'RT1050', '19954963677', NULL, 'Larissa Prado', '86288366757'),
  (9009, NULL, NULL, NOW() - INTERVAL '6 days', 'cancelled', 599.00, 0.00, 599.00, 'entrega', NULL, NULL, NULL, 'Renata Lima', '29537914806'),
  (9010, NULL, NULL, NOW() - INTERVAL '9 days', 'delivered', 1379.90, 25.00, 1404.90, 'entrega', NULL, NULL, 'BR555000222SP', 'Fernanda Alves', '15350946056'),
  (9011, NULL, NULL, NOW() - INTERVAL '35 days', 'delivered', 899.90, 0.00, 899.90, 'loja', 'RT1030', '19954963677', NULL, 'Aline Souza', '24843803483'),
  (9012, NULL, NULL, NOW() - INTERVAL '40 days', 'delivered', 1198.00, 30.00, 1228.00, 'entrega', NULL, NULL, 'BR555000333SP', 'Patrícia Rocha', '03781286031'),
  (9013, NULL, NULL, NOW() - INTERVAL '65 days', 'delivered', 480.00, 0.00, 480.00, 'loja', 'RT1020', '19954963677', NULL, 'Gabriela Nunes', '61236964030'),
  (9014, NULL, NULL, NOW() - INTERVAL '70 days', 'delivered', 1799.80, 0.00, 1799.80, 'entrega', NULL, NULL, 'BR555000444SP', 'Sofia Martins', '82178537464'),
  (9015, NULL, NULL, NOW() - INTERVAL '100 days', 'delivered', 599.00, 20.00, 619.00, 'entrega', NULL, NULL, 'BR555000555SP', 'Helena Dias', '45317828791'),
  (9016, NULL, NULL, NOW() - INTERVAL '130 days', 'delivered', 960.00, 0.00, 960.00, 'loja', 'RT1005', '19954963677', NULL, 'Clara Ribeiro', '93541134780'),
  (9017, NULL, NULL, NOW() - INTERVAL '150 days', 'cancelled', 899.90, 0.00, 899.90, 'entrega', NULL, NULL, NULL, 'Isabela Freitas', '68385217011')
ON CONFLICT DO NOTHING;

INSERT INTO order_item (id_item_pedido, id_pedido, id_variante, quantidade, preco_unitario)
VALUES
  (9001, 9001, 'VEST-MIDI-FLORAL-M', 1, 189.90),
  (9002, 9001, 'BLUSA-CANELADA-OFF-P', 1, 79.90),
  (9003, 9002, 'CALCA-ALFAIATARIA-PT-38', 1, 159.90),
  (9004, 9003, 'VEST-MIDI-FLORAL-P', 1, 189.90),
  (9005, 9004, 'DK-009-RO-M', 1, 899.90),
  (9006, 9005, 'DK-009-RO-P', 1, 899.90),
  (9007, 9005, 'BLUSA-CANELADA-OFF-M', 1, 349.10),
  (9008, 9006, 'DK-008-BO-G', 1, 599.00),
  (9009, 9007, 'DK-012-PR-P', 1, 480.00),
  (9010, 9008, 'DK-012-PR-M', 2, 480.00),
  (9011, 9009, 'DK-008-BO-M', 1, 599.00),
  (9012, 9010, 'DK-009-RO-P', 1, 899.90),
  (9013, 9010, 'DK-012-PR-M', 1, 480.00),
  (9014, 9011, 'DK-009-RO-M', 1, 899.90),
  (9015, 9012, 'DK-008-BO-G', 2, 599.00),
  (9016, 9013, 'DK-012-PR-P', 1, 480.00),
  (9017, 9014, 'DK-009-RO-P', 2, 899.90),
  (9018, 9015, 'DK-008-BO-M', 1, 599.00),
  (9019, 9016, 'DK-012-PR-M', 2, 480.00),
  (9020, 9017, 'DK-009-RO-M', 1, 899.90)
ON CONFLICT DO NOTHING;

INSERT INTO payment (
  id_pagamento, id_pedido, order_nsu, transaction_nsu, invoice_slug, amount, paid_amount, installments, capture_method, status, receipt_url, redirect_url, webhook_url, created_at, updated_at
)
VALUES
  (9001, 9001, 'ORDER-9001', 'TXN-9001', 'invoice-9001', 262.72, 262.72, 1, 'pix', 'paid', 'https://example.com/receipt/9001', NULL, 'https://example.com/webhook/payment', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  (9002, 9002, 'ORDER-9002', NULL, 'invoice-9002', 159.90, NULL, 1, 'credit_card', 'pending', NULL, 'https://example.com/pay/9002', 'https://example.com/webhook/payment', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  (9003, 9003, 'ORDER-9003', 'TXN-9003', 'invoice-9003', 176.42, 176.42, 1, 'pix', 'paid', 'https://example.com/receipt/9003', NULL, 'https://example.com/webhook/payment', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- Sequências: o próximo ID gerado pela aplicação fica depois dos IDs do seed.
SELECT setval('address_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM address), 1), 1), true);
SELECT setval('category_id_categoria_seq', GREATEST(COALESCE((SELECT MAX(id_categoria) FROM category), 1), 1), true);
SELECT setval('product_id_produto_seq', GREATEST(COALESCE((SELECT MAX(id_produto) FROM product), 1), 1), true);
SELECT setval('image_id_imagem_seq', GREATEST(COALESCE((SELECT MAX(id_imagem) FROM image), 1), 1), true);
SELECT setval('orders_id_pedido_seq', GREATEST(COALESCE((SELECT MAX(id_pedido) FROM orders), 1), 1), true);
SELECT setval('order_item_id_item_pedido_seq', GREATEST(COALESCE((SELECT MAX(id_item_pedido) FROM order_item), 1), 1), true);
SELECT setval('payment_id_pagamento_seq', GREATEST(COALESCE((SELECT MAX(id_pagamento) FROM payment), 1), 1), true);
SELECT setval('sales_goal_id_goal_seq', GREATEST(COALESCE((SELECT MAX(id_goal) FROM sales_goal), 1), 1), true);

COMMIT;
