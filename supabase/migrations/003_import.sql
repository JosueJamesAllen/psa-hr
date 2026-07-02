-- =====================================================================
-- Migration 003: roster import + opening balances
-- Opening balances computed as of end of 2026-05 from 2025_EMPLOYEES-LEAVE-CARD.xlsx
-- Wellness grants are NOT seeded here (handled by the grant job to avoid double-counting).
-- =====================================================================

-- units
insert into units (name) values
  ('Administrative'),
  ('Civil Registration'),
  ('National ID'),
  ('Statistical')
on conflict do nothing;

-- employees
insert into employees (last_name,first_name,middle_name,position,emp_class,cosw_sub,unit_id,salary,daily_wage,salary_grade,account_status) values
  ('Opis','Gemma','N.','Chief Statistical Specialist','regular',null,(select id from units where name='Administrative'),104209,null,'SG 24 Step 2','approved'),
  ('Mercene','Orlando','L.','Supervising Statistical Specialist','regular',null,(select id from units where name='Statistical'),82963,null,'SG 22 Step 2','approved'),
  ('Fabaleña','Harvy','M.','Senior Statistical Specialist','regular',null,(select id from units where name='Statistical'),59153,null,'SG 19 Step 1','approved'),
  ('Sualog','Maria Baby Jane','M.','Statistical Specialist II','regular',null,(select id from units where name='Statistical'),45694,null,'SG 16 Step 1','approved'),
  ('Muhi','Ginalyn','M.','Registration Officer II','regular',null,(select id from units where name='Civil Registration'),39141,null,'SG 14 Step 2','approved'),
  ('Jasmin','Olivia','J.','Administrative Officer I','regular',null,(select id from units where name='Administrative'),33302,null,'SG 11 Step 7','approved'),
  ('De La Cruz','Sonny Jr.','R.','Statistical Analyst','regular',null,(select id from units where name='Statistical'),31705,null,'SG 11 Step 1','approved'),
  ('Cuadrasal','Hazel','J.','Administrative Officer I','regular',null,(select id from units where name='Administrative'),27565,null,'SG 10 Step 4','approved'),
  ('Macutong','Mary Michelle','M.','Registration Officer I','regular',null,(select id from units where name='Civil Registration'),27131,null,'SG 10 Step 2','approved'),
  ('Olivar','Purita','H.','Assistant Statistician','regular',null,(select id from units where name='Statistical'),25725,null,'SG 9 Step 8','approved'),
  ('Montiano','Cedric','H.',null,'regular',null,(select id from units where name='Statistical'),null,null,null,'disabled'),
  ('Medallon','Frenz Darren','J.','Information Systems Analyst I','contractual',null,(select id from units where name='Statistical'),33947,null,'SG 12 Step 1','approved'),
  ('Gamara','Danica','J.','Information Officer I','contractual',null,(select id from units where name='National ID'),31705,null,'SG 11 Step 1','approved'),
  ('Janda','Jiezle','B.','Registration Officer II','cosw','contract_of_service',(select id from units where name='National ID'),37024,null,'SG 14','approved'),
  ('Nambio','John Mar','A.','Information Systems Analyst I','cosw','contract_of_service',(select id from units where name='National ID'),32245,null,'SG 12','approved'),
  ('Josue','James Allen','M.','Information Systems Analyst I','cosw','contract_of_service',(select id from units where name='Statistical'),32245,null,'SG 12','approved'),
  ('Matibag','Kane Carol','T.','Statistical Analyst','cosw','contract_of_service',(select id from units where name='Statistical'),30024,null,'SG 11','approved'),
  ('Mayores','Abejen Shayne','P.','Statistical Analyst','cosw','contract_of_service',(select id from units where name='Statistical'),30024,null,'SG 11','approved'),
  ('Rabi','Brenz Axel','M.','Statistical Analyst','cosw','contract_of_service',(select id from units where name='Statistical'),30024,null,'SG 11','approved'),
  ('Luci','Michelle','V.','Assistant Statistician','cosw','contract_of_service',(select id from units where name='Statistical'),23226,null,'SG 9','approved'),
  ('Manlisis','Charlotte','M.','Assistant Statistician','cosw','contract_of_service',(select id from units where name='Statistical'),23226,null,'SG 9','approved'),
  ('Matining','Shiela Mae','D.','Birth Registration Coordinator','cosw','job_order',(select id from units where name='Civil Registration'),null,914.09,'SG 7','approved'),
  ('Llante','Rocco','V.','Driver','cosw','job_order',(select id from units where name='Administrative'),null,765.14,'SG 4','approved'),
  ('Ali','Ahlee Khan','H.','Driver','cosw','job_order',(select id from units where name='Administrative'),null,765.14,'SG 4','approved'),
  ('Layron','Marjorie','O.','Administrative Clerk','cosw','job_order',(select id from units where name='Administrative'),null,678.41,'SG 2','approved'),
  ('Mutya','Jennen','M.','Administrative Clerk','cosw','job_order',(select id from units where name='Administrative'),null,678.41,'SG 2','approved'),
  ('Minay','Myla','G.','Civil Registration Clerk','cosw','job_order',(select id from units where name='Civil Registration'),null,678.41,'SG 2','approved');

-- TODO: grant app_role='admin' to HR/authorized accounts (e.g. AO1/HRMO Jasmin) before launch.

-- signatory seats (3 internal by name, RD external)
insert into signatory_seats (seat, employee_id) values
  ('ao1_hrmo',(select id from employees where last_name='Jasmin' and first_name='Olivia')),
  ('css',     (select id from employees where last_name='Opis' and first_name='Gemma')),
  ('sss',     (select id from employees where last_name='Mercene' and first_name='Orlando'));
insert into signatory_seats (seat, holder_name, is_external, reminder_date, reminder_note)
  values ('rd','Leni R. Rioflorido',true,'2026-11-01','RD retiring Nov 2026 — update successor');

-- opening VL/SL balances (active regular/contractual only)
insert into leave_balances (employee_id,category,period_label,earned,used) values
  ((select id from employees where last_name='Cuadrasal' and first_name='Hazel'),'vacation','cumulative',157.26,0),
  ((select id from employees where last_name='Cuadrasal' and first_name='Hazel'),'sick','cumulative',189.25,0),
  ((select id from employees where last_name='De La Cruz' and first_name='Sonny Jr.'),'vacation','cumulative',25.215,0),
  ((select id from employees where last_name='De La Cruz' and first_name='Sonny Jr.'),'sick','cumulative',26.999,0),
  ((select id from employees where last_name='Fabaleña' and first_name='Harvy'),'vacation','cumulative',35.626,0),
  ((select id from employees where last_name='Fabaleña' and first_name='Harvy'),'sick','cumulative',35.625,0),
  ((select id from employees where last_name='Jasmin' and first_name='Olivia'),'vacation','cumulative',291.353,0),
  ((select id from employees where last_name='Jasmin' and first_name='Olivia'),'sick','cumulative',318.0,0),
  ((select id from employees where last_name='Macutong' and first_name='Mary Michelle'),'vacation','cumulative',115.623,0),
  ((select id from employees where last_name='Macutong' and first_name='Mary Michelle'),'sick','cumulative',18.25,0),
  ((select id from employees where last_name='Mercene' and first_name='Orlando'),'vacation','cumulative',205.76,0),
  ((select id from employees where last_name='Mercene' and first_name='Orlando'),'sick','cumulative',229.5,0),
  ((select id from employees where last_name='Muhi' and first_name='Ginalyn'),'vacation','cumulative',167.35,0),
  ((select id from employees where last_name='Muhi' and first_name='Ginalyn'),'sick','cumulative',209.0,0),
  ((select id from employees where last_name='Olivar' and first_name='Purita'),'vacation','cumulative',242.481,0),
  ((select id from employees where last_name='Olivar' and first_name='Purita'),'sick','cumulative',193.181,0),
  ((select id from employees where last_name='Opis' and first_name='Gemma'),'vacation','cumulative',181.301,0),
  ((select id from employees where last_name='Opis' and first_name='Gemma'),'sick','cumulative',367.458,0),
  ((select id from employees where last_name='Sualog' and first_name='Maria Baby Jane'),'vacation','cumulative',102.835,0),
  ((select id from employees where last_name='Sualog' and first_name='Maria Baby Jane'),'sick','cumulative',104.5,0),
  ((select id from employees where last_name='Gamara' and first_name='Danica'),'vacation','cumulative',41.758,0),
  ((select id from employees where last_name='Gamara' and first_name='Danica'),'sick','cumulative',37.5,0),
  ((select id from employees where last_name='Medallon' and first_name='Frenz Darren'),'vacation','cumulative',11.829,0),
  ((select id from employees where last_name='Medallon' and first_name='Frenz Darren'),'sick','cumulative',12.416,0);

insert into leave_ledger (employee_id,period,entry_type,category,earned,charged,balance_after) values
  ((select id from employees where last_name='Cuadrasal' and first_name='Hazel'),'2026-05-28','balance_forward','vacation',157.26,0,157.26),
  ((select id from employees where last_name='Cuadrasal' and first_name='Hazel'),'2026-05-28','balance_forward','sick',189.25,0,189.25),
  ((select id from employees where last_name='De La Cruz' and first_name='Sonny Jr.'),'2026-05-28','balance_forward','vacation',25.215,0,25.215),
  ((select id from employees where last_name='De La Cruz' and first_name='Sonny Jr.'),'2026-05-28','balance_forward','sick',26.999,0,26.999),
  ((select id from employees where last_name='Fabaleña' and first_name='Harvy'),'2026-05-28','balance_forward','vacation',35.626,0,35.626),
  ((select id from employees where last_name='Fabaleña' and first_name='Harvy'),'2026-05-28','balance_forward','sick',35.625,0,35.625),
  ((select id from employees where last_name='Jasmin' and first_name='Olivia'),'2026-05-28','balance_forward','vacation',291.353,0,291.353),
  ((select id from employees where last_name='Jasmin' and first_name='Olivia'),'2026-05-28','balance_forward','sick',318.0,0,318.0),
  ((select id from employees where last_name='Macutong' and first_name='Mary Michelle'),'2026-05-28','balance_forward','vacation',115.623,0,115.623),
  ((select id from employees where last_name='Macutong' and first_name='Mary Michelle'),'2026-05-28','balance_forward','sick',18.25,0,18.25),
  ((select id from employees where last_name='Mercene' and first_name='Orlando'),'2026-05-28','balance_forward','vacation',205.76,0,205.76),
  ((select id from employees where last_name='Mercene' and first_name='Orlando'),'2026-05-28','balance_forward','sick',229.5,0,229.5),
  ((select id from employees where last_name='Muhi' and first_name='Ginalyn'),'2026-05-28','balance_forward','vacation',167.35,0,167.35),
  ((select id from employees where last_name='Muhi' and first_name='Ginalyn'),'2026-05-28','balance_forward','sick',209.0,0,209.0),
  ((select id from employees where last_name='Olivar' and first_name='Purita'),'2026-05-28','balance_forward','vacation',242.481,0,242.481),
  ((select id from employees where last_name='Olivar' and first_name='Purita'),'2026-05-28','balance_forward','sick',193.181,0,193.181),
  ((select id from employees where last_name='Opis' and first_name='Gemma'),'2026-05-28','balance_forward','vacation',181.301,0,181.301),
  ((select id from employees where last_name='Opis' and first_name='Gemma'),'2026-05-28','balance_forward','sick',367.458,0,367.458),
  ((select id from employees where last_name='Sualog' and first_name='Maria Baby Jane'),'2026-05-28','balance_forward','vacation',102.835,0,102.835),
  ((select id from employees where last_name='Sualog' and first_name='Maria Baby Jane'),'2026-05-28','balance_forward','sick',104.5,0,104.5),
  ((select id from employees where last_name='Gamara' and first_name='Danica'),'2026-05-28','balance_forward','vacation',41.758,0,41.758),
  ((select id from employees where last_name='Gamara' and first_name='Danica'),'2026-05-28','balance_forward','sick',37.5,0,37.5),
  ((select id from employees where last_name='Medallon' and first_name='Frenz Darren'),'2026-05-28','balance_forward','vacation',11.829,0,11.829),
  ((select id from employees where last_name='Medallon' and first_name='Frenz Darren'),'2026-05-28','balance_forward','sick',12.416,0,12.416);