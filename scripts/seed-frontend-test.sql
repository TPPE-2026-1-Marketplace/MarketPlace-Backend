BEGIN;

INSERT INTO person (cpf, nome, email, telefone, senha)
VALUES
  ('11111111111', 'Cliente Teste', 'cliente@teste.com', '11999990001', '$2b$10$gvvai5RdJtW96vJusjjTteRe3SfQ6xCch1QArsGyOPBqYNzeyPRiK'),
  ('22222222222', 'Gerente Teste', 'gerente@teste.com', '11999990002', '$2b$10$jIU6AYYznmcAFi7izVcj..hZbvP2UIxkWkhxLof2VgHZ5CTaJdHAC'),
  ('33333333333', 'Vendedor Teste', 'vendedor@teste.com', '11999990003', '$2b$10$ErcQvDgxXRxnzIK7rUJl3.oAynNfeyDfqTdMFkEGRHadTx3xayeYO'),
  ('44444444444', 'Caixa Teste', 'caixa@teste.com', '11999990004', '$2b$10$HChFbXEBMH.tVsEp8Ny2QO6yTAqfcz/mk3K.k0yJ0UlwwTxGSYX3C')
ON CONFLICT (cpf) DO NOTHING;

INSERT INTO employee (cpf, ativo, role_perfil, taxa_comissao, meta_vendas, codigo_funcionario)
VALUES
  ('22222222222', true, 'gerente', 0.0500, 25000.00, 'GER001'),
  ('33333333333', true, 'vendedor', 0.0350, 12000.00, 'VEN001'),
  ('44444444444', true, 'caixa', 0.0200, NULL, 'CX001')
ON CONFLICT (cpf) DO NOTHING;

INSERT INTO address (id, cpf_pessoa, cep, logradouro, numero, complemento, bairro, cidade, uf)
VALUES
  (1, '11111111111', '01310-100', 'Avenida Paulista', '1000', 'Apto 101', 'Bela Vista', 'São Paulo', 'SP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO category (id_categoria, nome)
VALUES
  (1, 'Vestidos'),
  (2, 'Blusas'),
  (3, 'Calças'),
  (4, 'Acessórios')
ON CONFLICT (id_categoria) DO NOTHING;

INSERT INTO product (
  id_produto, titulo, descricao, destaque, qual_medida, material, composicao, silhueta, tags, preco_base, sku, media_avaliacao, total_avaliacoes
)
VALUES
  (1, 'Vestido Midi Floral', 'Vestido leve para uso casual, com caimento solto e estampa floral.', true, 'Modelagem padrão', 'Viscose', '100% viscose', 'Midi', 'floral,casual,verao', 189.90, 'VEST-MIDI-FLORAL', 4.50, 2),
  (2, 'Blusa Canelada Off White', 'Blusa básica canelada com manga curta.', true, 'Modelagem ajustada', 'Malha canelada', '96% algodão, 4% elastano', 'Slim', 'basica,canelada', 79.90, 'BLUSA-CANELADA-OFF', 5.00, 1),
  (3, 'Calça Alfaiataria Preta', 'Calça de alfaiataria com corte reto para trabalho e eventos.', false, 'Cintura alta', 'Poliéster', '92% poliéster, 8% elastano', 'Reta', 'alfaiataria,social', 159.90, 'CALCA-ALFAIATARIA-PT', 0.00, 0)
ON CONFLICT (id_produto) DO NOTHING;

INSERT INTO product_category (product_id, category_id)
VALUES
  (1, 1),
  (2, 2),
  (3, 3)
ON CONFLICT DO NOTHING;

INSERT INTO product_variant (codigo_sku, preco_variante, ativo, cor, tamanho, medidas, id_produto)
VALUES
  ('VEST-MIDI-FLORAL-P', 189.90, true, 'Azul Floral', 'P', '{"busto":88,"cintura":72,"quadril":96,"comprimento":118}'::jsonb, 1),
  ('VEST-MIDI-FLORAL-M', 189.90, true, 'Azul Floral', 'M', '{"busto":94,"cintura":78,"quadril":102,"comprimento":120}'::jsonb, 1),
  ('BLUSA-CANELADA-OFF-P', 79.90, true, 'Off White', 'P', '{"busto":84,"comprimento":56}'::jsonb, 2),
  ('BLUSA-CANELADA-OFF-M', 79.90, true, 'Off White', 'M', '{"busto":90,"comprimento":58}'::jsonb, 2),
  ('CALCA-ALFAIATARIA-PT-38', 159.90, true, 'Preta', '38', '{"cintura":74,"quadril":100,"comprimento":104}'::jsonb, 3),
  ('CALCA-ALFAIATARIA-PT-40', 159.90, true, 'Preta', '40', '{"cintura":78,"quadril":104,"comprimento":105}'::jsonb, 3)
ON CONFLICT (codigo_sku) DO NOTHING;

INSERT INTO stock (codigo_sku, qtd_online, qtd_loja_fisica)
VALUES
  ('VEST-MIDI-FLORAL-P', 8, 2),
  ('VEST-MIDI-FLORAL-M', 5, 1),
  ('BLUSA-CANELADA-OFF-P', 12, 4),
  ('BLUSA-CANELADA-OFF-M', 9, 3),
  ('CALCA-ALFAIATARIA-PT-38', 3, 1),
  ('CALCA-ALFAIATARIA-PT-40', 0, 2)
ON CONFLICT (codigo_sku) DO NOTHING;

INSERT INTO image (id_imagem, url, ordem, descricao, local_renderizacao)
VALUES
  (1, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80', 0, 'Vestido floral frente', 'catalogo'),
  (2, 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80', 1, 'Vestido floral detalhe', 'catalogo'),
  (3, 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=900&q=80', 0, 'Blusa canelada frente', 'catalogo'),
  (4, 'https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=900&q=80', 0, 'Calça alfaiataria frente', 'catalogo')
ON CONFLICT (id_imagem) DO NOTHING;

INSERT INTO catalog_image (id_imagem, codigo_sku, ordem_no_catalogo)
VALUES
  (1, 'VEST-MIDI-FLORAL-P', 0),
  (2, 'VEST-MIDI-FLORAL-P', 1),
  (1, 'VEST-MIDI-FLORAL-M', 0),
  (2, 'VEST-MIDI-FLORAL-M', 1),
  (3, 'BLUSA-CANELADA-OFF-P', 0),
  (3, 'BLUSA-CANELADA-OFF-M', 0),
  (4, 'CALCA-ALFAIATARIA-PT-38', 0),
  (4, 'CALCA-ALFAIATARIA-PT-40', 0)
ON CONFLICT DO NOTHING;

INSERT INTO coupon (
  numero_do_cupom, tipo_cupom, valor_desconto, ativo, data_inicio, data_fim, uso_maximo, nome_influenciador, usos_atuais
)
VALUES
  ('BEMVINDA10', 'porcentagem', 10.00, true, NOW() - INTERVAL '30 days', NOW() + INTERVAL '180 days', 500, NULL, 0),
  ('ANA15', 'porcentagem', 15.00, true, NOW() - INTERVAL '10 days', NOW() + INTERVAL '90 days', 100, 'Ana Influencer', 3),
  ('LOOK20', 'fixo', 20.00, true, NOW() - INTERVAL '5 days', NOW() + INTERVAL '60 days', 50, NULL, 1)
ON CONFLICT (numero_do_cupom) DO NOTHING;

INSERT INTO coupon_product (coupon_id, product_id)
VALUES
  ('ANA15', 1),
  ('LOOK20', 2)
ON CONFLICT DO NOTHING;

INSERT INTO review (cpf_cliente, id_produto, nota, comentario, data_avaliacao)
VALUES
  ('11111111111', 1, 5, 'Vestido muito bonito e vestiu super bem.', NOW() - INTERVAL '7 days'),
  ('22222222222', 1, 4, 'Tecido bom e ótimo acabamento.', NOW() - INTERVAL '3 days'),
  ('11111111111', 2, 5, 'Blusa básica excelente para o dia a dia.', NOW() - INTERVAL '2 days')
ON CONFLICT (cpf_cliente, id_produto) DO NOTHING;

INSERT INTO orders (
  id_pedido, id_usuario, id_cupom, data_pedido, status, subtotal, valor_frete, valor_total, tipo_retirada, codigo_verificacao_retirada, id_funcionario, codigo_rastreamento
)
VALUES
  (1, '11111111111', 'BEMVINDA10', NOW() - INTERVAL '4 days', 'paid', 269.80, 19.90, 262.72, 'entrega', NULL, NULL, 'BR123456789SP'),
  (2, '11111111111', NULL, NOW() - INTERVAL '1 day', 'pending', 159.90, 0.00, 159.90, 'loja', 'RETIRA-ABC-123', '44444444444', NULL),
  (3, '11111111111', 'ANA15', NOW() - INTERVAL '12 days', 'delivered', 189.90, 15.00, 176.42, 'entrega', NULL, NULL, 'BR987654321SP')
ON CONFLICT (id_pedido) DO NOTHING;

INSERT INTO order_item (id_item_pedido, id_pedido, id_variante, quantidade, preco_unitario)
VALUES
  (1, 1, 'VEST-MIDI-FLORAL-M', 1, 189.90),
  (2, 1, 'BLUSA-CANELADA-OFF-P', 1, 79.90),
  (3, 2, 'CALCA-ALFAIATARIA-PT-38', 1, 159.90),
  (4, 3, 'VEST-MIDI-FLORAL-P', 1, 189.90)
ON CONFLICT (id_item_pedido) DO NOTHING;

INSERT INTO payment (
  id_pagamento, id_pedido, order_nsu, transaction_nsu, invoice_slug, amount, paid_amount, installments, capture_method, status, receipt_url, redirect_url, webhook_url, created_at, updated_at
)
VALUES
  (1, 1, 'ORDER-001', 'TXN-001', 'invoice-001', 262.72, 262.72, 1, 'pix', 'paid', 'https://example.com/receipt/1', NULL, 'https://example.com/webhook/payment', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  (2, 2, 'ORDER-002', NULL, 'invoice-002', 159.90, NULL, 1, 'credit_card', 'pending', NULL, 'https://example.com/pay/2', 'https://example.com/webhook/payment', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  (3, 3, 'ORDER-003', 'TXN-003', 'invoice-003', 176.42, 176.42, 1, 'pix', 'paid', 'https://example.com/receipt/3', NULL, 'https://example.com/webhook/payment', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days')
ON CONFLICT (id_pagamento) DO NOTHING;

INSERT INTO sales_goal (id_goal, cpf_funcionario, mes, ano, valor_meta, taxa_comissao_bonus)
VALUES
  (1, NULL, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(YEAR FROM CURRENT_DATE)::int, 50000.00, 0.0100),
  (2, '33333333333', EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(YEAR FROM CURRENT_DATE)::int, 12000.00, 0.0150)
ON CONFLICT (cpf_funcionario, mes, ano) DO NOTHING;

SELECT setval('address_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM address), 1), 1), true);
SELECT setval('category_id_categoria_seq', GREATEST(COALESCE((SELECT MAX(id_categoria) FROM category), 1), 1), true);
SELECT setval('product_id_produto_seq', GREATEST(COALESCE((SELECT MAX(id_produto) FROM product), 1), 1), true);
SELECT setval('image_id_imagem_seq', GREATEST(COALESCE((SELECT MAX(id_imagem) FROM image), 1), 1), true);
SELECT setval('orders_id_pedido_seq', GREATEST(COALESCE((SELECT MAX(id_pedido) FROM orders), 1), 1), true);
SELECT setval('order_item_id_item_pedido_seq', GREATEST(COALESCE((SELECT MAX(id_item_pedido) FROM order_item), 1), 1), true);
SELECT setval('payment_id_pagamento_seq', GREATEST(COALESCE((SELECT MAX(id_pagamento) FROM payment), 1), 1), true);
SELECT setval('sales_goal_id_goal_seq', GREATEST(COALESCE((SELECT MAX(id_goal) FROM sales_goal), 1), 1), true);

COMMIT;
