-- =====================================================================
-- Migration 003: roster import + opening balances
-- employee_id_no is the unique business key (text; preserves leading zeros).
-- Opening balances as of end of 2026-05 from 2025_EMPLOYEES-LEAVE-CARD.xlsx.
-- Wellness grants NOT seeded here (grant job handles them).
-- =====================================================================

insert into units (name) values
  ('Administrative'),
  ('Civil Registration'),
  ('National ID'),
  ('Statistical')
on conflict do nothing;

-- employees
insert into employees (employee_id_no,last_name,first_name,middle_name,position,emp_class,cosw_sub,unit_id,salary,daily_wage,salary_grade,account_status) values
  ('59579','Opis','Gemma','N.','Chief Statistical Specialist','regular',null,(select id from units where name='Administrative'),104209,null,'SG 24 Step 2','approved'),
  ('72334','Mercene','Orlando','L.','Supervising Statistical Specialist','regular',null,(select id from units where name='Statistical'),82963,null,'SG 22 Step 2','approved'),
  ('115590','Fabaleña','Harvy','M.','Senior Statistical Specialist','regular',null,(select id from units where name='Statistical'),59153,null,'SG 19 Step 1','approved'),
  ('095094','Sualog','Maria Baby Jane','M.','Statistical Specialist II','regular',null,(select id from units where name='Statistical'),45694,null,'SG 16 Step 1','approved'),
  ('011492','Muhi','Ginalyn','M.','Registration Officer II','regular',null,(select id from units where name='Civil Registration'),39141,null,'SG 14 Step 2','approved'),
  ('005976','Jasmin','Olivia','J.','Administrative Officer I','regular',null,(select id from units where name='Administrative'),33302,null,'SG 11 Step 7','approved'),
  ('120322','De La Cruz','Sonny Jr.','R.','Statistical Analyst','regular',null,(select id from units where name='Statistical'),31705,null,'SG 11 Step 1','approved'),
  ('075935','Cuadrasal','Hazel','J.','Administrative Officer I','regular',null,(select id from units where name='Administrative'),27565,null,'SG 10 Step 4','approved'),
  ('091141','Macutong','Mary Michelle','M.','Registration Officer I','regular',null,(select id from units where name='Civil Registration'),27131,null,'SG 10 Step 2','approved'),
  ('068183','Olivar','Purita','H.','Assistant Statistician','regular',null,(select id from units where name='Statistical'),25725,null,'SG 9 Step 8','approved'),
  (null,'Montiano','Cedric','H.',null,'regular',null,(select id from units where name='Statistical'),null,null,null,'disabled'),
  ('124291','Medallon','Frenz Darren','J.','Information Systems Analyst I','contractual',null,(select id from units where name='Statistical'),33947,null,'SG 12 Step 1','approved'),
  ('115053','Gamara','Danica','J.','Information Officer I','contractual',null,(select id from units where name='National ID'),31705,null,'SG 11 Step 1','approved'),
  ('2018-05-010','Janda','Jiezle','B.','Registration Officer II','cosw','contract_of_service',(select id from units where name='National ID'),37024,null,'SG 14','approved'),
  ('2022-07-272','Nambio','John Mar','A.','Information Systems Analyst I','cosw','contract_of_service',(select id from units where name='National ID'),32245,null,'SG 12','approved'),
  ('2026-03-736','Josue','James Allen','M.','Information Systems Analyst I','cosw','contract_of_service',(select id from units where name='Statistical'),32245,null,'SG 12','approved'),
  ('2024-01-507','Matibag-Pajanustan','Kane Carol','T.','Statistical Analyst','cosw','contract_of_service',(select id from units where name='Statistical'),30024,null,'SG 11','approved'),
  ('2026-02-735','Mayores','Abejen Shayne','P.','Statistical Analyst','cosw','contract_of_service',(select id from units where name='Statistical'),30024,null,'SG 11','approved'),
  ('2026-02-734','Rabi','Brenz Axel','M.','Statistical Analyst','cosw','contract_of_service',(select id from units where name='Statistical'),30024,null,'SG 11','approved'),
  ('2021-07-179','Luci','Michelle','V.','Assistant Statistician','cosw','contract_of_service',(select id from units where name='Statistical'),23226,null,'SG 9','approved'),
  ('2018-07-031','Manlisis','Charlotte','M.','Assistant Statistician','cosw','contract_of_service',(select id from units where name='Statistical'),23226,null,'SG 9','approved'),
  ('2021-07-181','Matining','Shiela Mae','D.','Birth Registration Coordinator','cosw','job_order',(select id from units where name='Civil Registration'),null,914.09,'SG 7','approved'),
  ('2016-01-004','Llante','Rocco','V.','Driver','cosw','job_order',(select id from units where name='Administrative'),null,765.14,'SG 4','approved'),
  ('2025-03-682','Ali','Ahlee Khan','H.','Driver','cosw','job_order',(select id from units where name='Administrative'),null,765.14,'SG 4','approved'),
  ('2021-12-236','Layron','Marjorie','O.','Administrative Clerk','cosw','job_order',(select id from units where name='Administrative'),null,678.41,'SG 2','approved'),
  ('2025-06-692','Mutya','Jennen','M.','Administrative Clerk','cosw','job_order',(select id from units where name='Administrative'),null,678.41,'SG 2','approved'),
  ('2025-09-710','Minay','Myla','G.','Civil Registration Clerk','cosw','job_order',(select id from units where name='Civil Registration'),null,678.41,'SG 2','approved'),
  ('2023-07-337','Rodelas','Ana Rosechel',null,'Registration Assistant','cosw','job_order',(select id from units where name='National ID'),null,693.86,'SG 3','approved'),
  ('2021-10-212','Pelaez','Neil Aldrin','M.','Registration Kit Operator','cosw','job_order',(select id from units where name='National ID'),null,880.23,'SG 7','approved'),
  ('2024-09-663','Murillo','John Paulo','R.','Registration Kit Operator','cosw','job_order',(select id from units where name='National ID'),null,880.23,'SG 7','approved'),
  ('2021-01-107','Malapote','Lester Benedict I','P.','Registration Assistant','cosw','job_order',(select id from units where name='National ID'),null,693.86,'SG 3','approved'),
  ('2023-08-401','Tan','Eddie','M.','Registration Assistant','cosw','job_order',(select id from units where name='National ID'),null,693.86,'SG 3','approved');

-- TODO: set app_role='admin' for HR/authorized accounts before launch.

-- signatory seats (match by ID; RD external by name)
insert into signatory_seats (seat, employee_id) values
  ('ao1_hrmo',(select id from employees where employee_id_no='005976')),
  ('css',     (select id from employees where employee_id_no='59579')),
  ('sss',     (select id from employees where employee_id_no='72334'));
insert into signatory_seats (seat, holder_name, is_external, reminder_date, reminder_note)
  values ('rd','Leni R. Rioflorido',true,'2026-11-01','RD retiring Nov 2026 — update successor');

-- opening VL/SL balances (active regular/contractual only)
insert into leave_balances (employee_id,category,period_label,earned,used) values
  ((select id from employees where employee_id_no='075935'),'vacation','cumulative',157.26,0),
  ((select id from employees where employee_id_no='075935'),'sick','cumulative',189.25,0),
  ((select id from employees where employee_id_no='120322'),'vacation','cumulative',25.215,0),
  ((select id from employees where employee_id_no='120322'),'sick','cumulative',26.999,0),
  ((select id from employees where employee_id_no='115590'),'vacation','cumulative',35.626,0),
  ((select id from employees where employee_id_no='115590'),'sick','cumulative',35.625,0),
  ((select id from employees where employee_id_no='005976'),'vacation','cumulative',291.353,0),
  ((select id from employees where employee_id_no='005976'),'sick','cumulative',318.0,0),
  ((select id from employees where employee_id_no='091141'),'vacation','cumulative',115.623,0),
  ((select id from employees where employee_id_no='091141'),'sick','cumulative',18.25,0),
  ((select id from employees where employee_id_no='72334'),'vacation','cumulative',205.76,0),
  ((select id from employees where employee_id_no='72334'),'sick','cumulative',229.5,0),
  ((select id from employees where employee_id_no='011492'),'vacation','cumulative',167.35,0),
  ((select id from employees where employee_id_no='011492'),'sick','cumulative',209.0,0),
  ((select id from employees where employee_id_no='068183'),'vacation','cumulative',242.481,0),
  ((select id from employees where employee_id_no='068183'),'sick','cumulative',193.181,0),
  ((select id from employees where employee_id_no='59579'),'vacation','cumulative',181.301,0),
  ((select id from employees where employee_id_no='59579'),'sick','cumulative',367.458,0),
  ((select id from employees where employee_id_no='095094'),'vacation','cumulative',102.835,0),
  ((select id from employees where employee_id_no='095094'),'sick','cumulative',104.5,0),
  ((select id from employees where employee_id_no='115053'),'vacation','cumulative',41.758,0),
  ((select id from employees where employee_id_no='115053'),'sick','cumulative',37.5,0),
  ((select id from employees where employee_id_no='124291'),'vacation','cumulative',11.829,0),
  ((select id from employees where employee_id_no='124291'),'sick','cumulative',12.416,0);

insert into leave_ledger (employee_id,period,entry_type,category,earned,charged,balance_after) values
  ((select id from employees where employee_id_no='075935'),'2026-05-28','balance_forward','vacation',157.26,0,157.26),
  ((select id from employees where employee_id_no='075935'),'2026-05-28','balance_forward','sick',189.25,0,189.25),
  ((select id from employees where employee_id_no='120322'),'2026-05-28','balance_forward','vacation',25.215,0,25.215),
  ((select id from employees where employee_id_no='120322'),'2026-05-28','balance_forward','sick',26.999,0,26.999),
  ((select id from employees where employee_id_no='115590'),'2026-05-28','balance_forward','vacation',35.626,0,35.626),
  ((select id from employees where employee_id_no='115590'),'2026-05-28','balance_forward','sick',35.625,0,35.625),
  ((select id from employees where employee_id_no='005976'),'2026-05-28','balance_forward','vacation',291.353,0,291.353),
  ((select id from employees where employee_id_no='005976'),'2026-05-28','balance_forward','sick',318.0,0,318.0),
  ((select id from employees where employee_id_no='091141'),'2026-05-28','balance_forward','vacation',115.623,0,115.623),
  ((select id from employees where employee_id_no='091141'),'2026-05-28','balance_forward','sick',18.25,0,18.25),
  ((select id from employees where employee_id_no='72334'),'2026-05-28','balance_forward','vacation',205.76,0,205.76),
  ((select id from employees where employee_id_no='72334'),'2026-05-28','balance_forward','sick',229.5,0,229.5),
  ((select id from employees where employee_id_no='011492'),'2026-05-28','balance_forward','vacation',167.35,0,167.35),
  ((select id from employees where employee_id_no='011492'),'2026-05-28','balance_forward','sick',209.0,0,209.0),
  ((select id from employees where employee_id_no='068183'),'2026-05-28','balance_forward','vacation',242.481,0,242.481),
  ((select id from employees where employee_id_no='068183'),'2026-05-28','balance_forward','sick',193.181,0,193.181),
  ((select id from employees where employee_id_no='59579'),'2026-05-28','balance_forward','vacation',181.301,0,181.301),
  ((select id from employees where employee_id_no='59579'),'2026-05-28','balance_forward','sick',367.458,0,367.458),
  ((select id from employees where employee_id_no='095094'),'2026-05-28','balance_forward','vacation',102.835,0,102.835),
  ((select id from employees where employee_id_no='095094'),'2026-05-28','balance_forward','sick',104.5,0,104.5),
  ((select id from employees where employee_id_no='115053'),'2026-05-28','balance_forward','vacation',41.758,0,41.758),
  ((select id from employees where employee_id_no='115053'),'2026-05-28','balance_forward','sick',37.5,0,37.5),
  ((select id from employees where employee_id_no='124291'),'2026-05-28','balance_forward','vacation',11.829,0,11.829),
  ((select id from employees where employee_id_no='124291'),'2026-05-28','balance_forward','sick',12.416,0,12.416);