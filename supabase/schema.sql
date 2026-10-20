-- =====================================================================
-- Berbert Hidrotech - estrutura do banco de dados (Supabase)
-- Execute este arquivo inteiro no "SQL Editor" do Supabase.
-- Pode rodar de novo sem perder dados (só cria o que ainda não existe).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Logins liberados
-- O PRIMEIRO login criado já entra liberado. Qualquer outro login começa
-- BLOQUEADO (assim ninguém de fora consegue ver os dados). Para liberar
-- outra pessoa, rode no SQL Editor:
--   update public.perfis set ativo = true where email = 'email@da.pessoa';
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  ativo boolean not null default false,
  criado_em timestamptz not null default now()
);

create or replace function public.usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ativo from perfis where id = auth.uid()), false);
$$;

create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  primeiro boolean;
begin
  perform pg_advisory_xact_lock(4243);
  primeiro := not exists (select 1 from perfis);
  insert into perfis (id, nome, email, ativo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''), coalesce(new.email, ''), primeiro);
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.novo_usuario();

-- Cria o perfil de logins que já existiam antes deste arquivo ser executado.
insert into public.perfis (id, email, ativo)
select u.id, coalesce(u.email, ''), false from auth.users u
where not exists (select 1 from public.perfis p where p.id = u.id)
order by u.created_at;
update public.perfis set ativo = true
where id = (select id from public.perfis order by criado_em limit 1)
  and not exists (select 1 from public.perfis where ativo);

alter table public.perfis enable row level security;
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select using (id = auth.uid());
drop policy if exists perfis_nome on public.perfis;
create policy perfis_nome on public.perfis for update
  using (id = auth.uid() and public.usuario_ativo()) with check (id = auth.uid() and public.usuario_ativo());
-- O próprio usuário só pode mudar o nome (não pode se liberar sozinho).
revoke update on public.perfis from authenticated;
grant update (nome) on public.perfis to authenticated;

-- ---------------------------------------------------------------------
-- Dados do sistema. Cada registro guarda seus campos em "dados" (JSON).
--   clientes     cadastro de clientes
--   servicos     serviços feitos (com laudo, fotos, valor e pagamento)
--   orcamentos   orçamentos enviados
--   lancamentos  gastos e outras entradas de dinheiro
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id text primary key, dados jsonb not null default '{}',
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.servicos (like public.clientes including all);
create table if not exists public.orcamentos (like public.clientes including all);
create table if not exists public.lancamentos (like public.clientes including all);

-- Configurações (dados da empresa, tabela de preços, mensagens...)
create table if not exists public.config (
  chave text primary key, valor jsonb not null default '{}'
);

do $$
declare t text;
begin
  foreach t in array array['clientes', 'servicos', 'orcamentos', 'lancamentos', 'config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_acesso', t);
    execute format('create policy %I on public.%I for all using (public.usuario_ativo()) with check (public.usuario_ativo())', t || '_acesso', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Fotos (laudos e comprovantes de gastos): pasta privada "fotos".
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists fotos_ler on storage.objects;
create policy fotos_ler on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.usuario_ativo());
drop policy if exists fotos_enviar on storage.objects;
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.usuario_ativo());
drop policy if exists fotos_alterar on storage.objects;
create policy fotos_alterar on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.usuario_ativo());
drop policy if exists fotos_excluir on storage.objects;
create policy fotos_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.usuario_ativo());

-- ============================================================
-- FIM DO ARQUIVO. Se esta linha aparece no editor, o texto foi copiado inteiro.
-- ============================================================
