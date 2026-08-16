INSERT INTO permissions(id, code) VALUES
  ('30000000-0000-0000-0000-000000000019', 'catalog:read'),
  ('30000000-0000-0000-0000-000000000020', 'catalog:manage')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM (VALUES
  ('ADMIN', 'catalog:read'),
  ('ADMIN', 'catalog:manage'),
  ('SUPER_ADMIN', 'catalog:read'),
  ('SUPER_ADMIN', 'catalog:manage')
) AS grant_matrix(role_code, permission_code)
JOIN roles role ON role.code = grant_matrix.role_code
JOIN permissions permission ON permission.code = grant_matrix.permission_code
ON CONFLICT DO NOTHING;
