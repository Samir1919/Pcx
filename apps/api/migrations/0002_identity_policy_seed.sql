INSERT INTO roles(id, code) VALUES
  ('20000000-0000-0000-0000-000000000001', 'CUSTOMER'),
  ('20000000-0000-0000-0000-000000000002', 'SUPPORT'),
  ('20000000-0000-0000-0000-000000000003', 'TECHNICIAN'),
  ('20000000-0000-0000-0000-000000000004', 'SUPERVISOR'),
  ('20000000-0000-0000-0000-000000000005', 'INVENTORY'),
  ('20000000-0000-0000-0000-000000000006', 'FINANCE'),
  ('20000000-0000-0000-0000-000000000007', 'ADMIN'),
  ('20000000-0000-0000-0000-000000000008', 'SUPER_ADMIN')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(id, code) VALUES
  ('30000000-0000-0000-0000-000000000001', 'profile:read:self'),
  ('30000000-0000-0000-0000-000000000002', 'profile:update:self'),
  ('30000000-0000-0000-0000-000000000003', 'address:manage:self'),
  ('30000000-0000-0000-0000-000000000004', 'customer:read:assigned'),
  ('30000000-0000-0000-0000-000000000005', 'inspection:read'),
  ('30000000-0000-0000-0000-000000000006', 'inspection:submit'),
  ('30000000-0000-0000-0000-000000000007', 'inspection:override'),
  ('30000000-0000-0000-0000-000000000008', 'inventory:read'),
  ('30000000-0000-0000-0000-000000000009', 'inventory:manage'),
  ('30000000-0000-0000-0000-000000000010', 'pricing:read'),
  ('30000000-0000-0000-0000-000000000011', 'pricing:manage'),
  ('30000000-0000-0000-0000-000000000012', 'payment:read'),
  ('30000000-0000-0000-0000-000000000013', 'acquisition-payment:manage'),
  ('30000000-0000-0000-0000-000000000014', 'refund:manage'),
  ('30000000-0000-0000-0000-000000000015', 'role:read'),
  ('30000000-0000-0000-0000-000000000016', 'role:assign'),
  ('30000000-0000-0000-0000-000000000017', 'audit:read'),
  ('30000000-0000-0000-0000-000000000018', 'system:configure')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM (VALUES
  ('CUSTOMER', 'profile:read:self'), ('CUSTOMER', 'profile:update:self'), ('CUSTOMER', 'address:manage:self'),
  ('SUPPORT', 'customer:read:assigned'), ('SUPPORT', 'inventory:read'), ('SUPPORT', 'inspection:read'),
  ('TECHNICIAN', 'inventory:read'), ('TECHNICIAN', 'inspection:read'), ('TECHNICIAN', 'inspection:submit'),
  ('SUPERVISOR', 'inventory:read'), ('SUPERVISOR', 'inspection:read'), ('SUPERVISOR', 'inspection:submit'), ('SUPERVISOR', 'inspection:override'),
  ('INVENTORY', 'inventory:read'), ('INVENTORY', 'inventory:manage'), ('INVENTORY', 'inspection:read'), ('INVENTORY', 'pricing:read'),
  ('FINANCE', 'payment:read'), ('FINANCE', 'acquisition-payment:manage'), ('FINANCE', 'refund:manage'), ('FINANCE', 'audit:read'),
  ('ADMIN', 'customer:read:assigned'), ('ADMIN', 'inventory:read'), ('ADMIN', 'inventory:manage'), ('ADMIN', 'inspection:read'),
  ('ADMIN', 'pricing:read'), ('ADMIN', 'pricing:manage'), ('ADMIN', 'payment:read'), ('ADMIN', 'role:read'),
  ('ADMIN', 'audit:read'), ('ADMIN', 'system:configure')
) AS grant_matrix(role_code, permission_code)
JOIN roles role ON role.code = grant_matrix.role_code
JOIN permissions permission ON permission.code = grant_matrix.permission_code
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
