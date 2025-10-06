-- Corrigir função create_commission_for_sale para usar gross_value como fallback
-- quando service_id for NULL em bases de serviço
CREATE OR REPLACE FUNCTION public.create_commission_for_sale(p_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale record;
  v_rule record;
  v_base_value numeric;
  v_commission_amount numeric;
  v_product_ids uuid[];
  v_product_categories text[];
  v_service_total_value numeric;
BEGIN
  -- Buscar dados da venda
  SELECT s.*, array_agg(si.product_id) as product_ids
  INTO v_sale
  FROM sales s
  LEFT JOIN sale_items si ON si.sale_id = s.id
  WHERE s.id = p_sale_id
  AND s.status = 'closed'
  GROUP BY s.id;

  -- Se venda não existe ou não está fechada, retornar
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Se a venda tem um service_id, buscar o total_value do serviço
  IF v_sale.service_id IS NOT NULL THEN
    SELECT total_value INTO v_service_total_value
    FROM services
    WHERE id = v_sale.service_id;
  ELSE
    v_service_total_value := NULL;
  END IF;

  -- Buscar categorias dos produtos
  SELECT array_agg(DISTINCT p.category)
  INTO v_product_categories
  FROM sale_items si
  JOIN products p ON p.id = si.product_id
  WHERE si.sale_id = p_sale_id;

  -- Buscar regra de comissão aplicável (prioridade: produto > categoria > geral)
  SELECT *
  INTO v_rule
  FROM commission_rules
  WHERE active = true
  AND (
    -- Regra específica de produto
    (scope = 'product' AND product_id = ANY(v_sale.product_ids))
    -- Regra de categoria
    OR (scope = 'category' AND category = ANY(v_product_categories))
    -- Regra geral
    OR scope = 'general'
  )
  ORDER BY 
    CASE scope
      WHEN 'product' THEN 1
      WHEN 'category' THEN 2
      WHEN 'general' THEN 3
    END
  LIMIT 1;

  -- Se não encontrou regra, retornar
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Determinar valor base para cálculo
  IF v_rule.base = 'gross' THEN
    v_base_value := v_sale.gross_value;
  ELSIF v_rule.base = 'profit' THEN
    v_base_value := v_sale.estimated_profit;
  ELSIF v_rule.base IN ('maintenance', 'revision', 'spraying') THEN
    -- Para bases de serviço, usar o total_value do serviço
    -- Se service_id for NULL, usar gross_value como fallback
    v_base_value := COALESCE(v_service_total_value, v_sale.gross_value);
  ELSE
    v_base_value := v_sale.gross_value;
  END IF;

  -- Calcular comissão
  v_commission_amount := (v_base_value * v_rule.percent / 100);

  -- Verificar se já existe comissão para esta venda
  IF EXISTS (SELECT 1 FROM commissions WHERE sale_id = p_sale_id) THEN
    -- Atualizar comissão existente
    UPDATE commissions
    SET 
      base = v_rule.base,
      percent = v_rule.percent,
      amount = v_commission_amount
    WHERE sale_id = p_sale_id;
  ELSE
    -- Criar nova comissão
    INSERT INTO commissions (
      sale_id,
      seller_auth_id,
      base,
      percent,
      amount,
      pay_status
    ) VALUES (
      p_sale_id,
      v_sale.seller_auth_id,
      v_rule.base,
      v_rule.percent,
      v_commission_amount,
      'pending'
    );
  END IF;
END;
$function$;

-- Reprocessar comissões existentes para corrigir valores
DO $$
DECLARE
  v_sale_id uuid;
BEGIN
  FOR v_sale_id IN 
    SELECT DISTINCT s.id
    FROM sales s
    WHERE s.status = 'closed'
  LOOP
    PERFORM public.create_commission_for_sale(v_sale_id);
  END LOOP;
END $$;