-- =====================================================================
-- Migration 002: reference seed data
-- =====================================================================

-- ---------- conversion table (transcribed exactly from HR's printed table,
--            8-hour day; reproduces existing leave cards to the decimal) ----------
insert into time_conversion (unit, amount, equivalent_day) values
('hour',1,0.125),('hour',2,0.250),('hour',3,0.375),('hour',4,0.500),
('hour',5,0.625),('hour',6,0.750),('hour',7,0.875),('hour',8,1.000),
('minute',1,0.002),('minute',2,0.004),('minute',3,0.006),('minute',4,0.008),
('minute',5,0.010),('minute',6,0.012),('minute',7,0.015),('minute',8,0.017),
('minute',9,0.019),('minute',10,0.021),('minute',11,0.023),('minute',12,0.025),
('minute',13,0.027),('minute',14,0.029),('minute',15,0.031),('minute',16,0.033),
('minute',17,0.035),('minute',18,0.037),('minute',19,0.040),('minute',20,0.042),
('minute',21,0.044),('minute',22,0.046),('minute',23,0.048),('minute',24,0.050),
('minute',25,0.052),('minute',26,0.054),('minute',27,0.056),('minute',28,0.058),
('minute',29,0.060),('minute',30,0.062),('minute',31,0.065),('minute',32,0.067),
('minute',33,0.069),('minute',34,0.071),('minute',35,0.073),('minute',36,0.075),
('minute',37,0.077),('minute',38,0.079),('minute',39,0.081),('minute',40,0.083),
('minute',41,0.085),('minute',42,0.087),('minute',43,0.090),('minute',44,0.092),
('minute',45,0.094),('minute',46,0.096),('minute',47,0.098),('minute',48,0.100),
('minute',49,0.102),('minute',50,0.104),('minute',51,0.106),('minute',52,0.108),
('minute',53,0.110),('minute',54,0.112),('minute',55,0.115),('minute',56,0.117),
('minute',57,0.119),('minute',58,0.121),('minute',59,0.123),('minute',60,0.125);
-- Helper: equivalent_day(total_minutes) = hour_rows[floor(min/60)] + minute_rows[min%60].

-- ---------- leave types ----------
-- routing: 'ao1_css' = AO1 certifies -> CSS approves (reg/contractual + all wellness)
--          'sss_css' = SSS recommends -> CSS approves (COSW unpaid VL/SL)
-- advance_min/max NULL => may be filed retroactively (e.g. sick, calamity).
insert into leave_types
  (code,name,csc_reference,category,applies_to,is_paid,requires_credits,annual_quota,expiry,advance_min_days,advance_max_days,routing) values
-- regular / contractual (CS Form 6)
('VL','Vacation Leave','Sec. 51, Rule XVI, EO 292','vacation','{regular,contractual}',true,true,null,'none',7,14,'ao1_css'),
('FL','Mandatory/Forced Leave','Sec. 25, Rule XVI, EO 292','vacation','{regular,contractual}',true,true,5,'none',7,14,'ao1_css'),
('SL','Sick Leave','Sec. 43, Rule XVI, EO 292','sick','{regular,contractual}',true,true,null,'none',null,null,'ao1_css'),
('SPL','Special Privilege Leave','Sec. 21, Rule XVI, EO 292','special','{regular,contractual}',true,true,3,'year_end',7,14,'ao1_css'),
('MAT','Maternity Leave','RA 11210','special','{regular,contractual}',true,false,null,'none',null,null,'ao1_css'),
('PAT','Paternity Leave','RA 8187','special','{regular,contractual}',true,false,7,'none',7,14,'ao1_css'),
('SOLO','Solo Parent Leave','RA 8972','special','{regular,contractual}',true,false,7,'year_end',7,14,'ao1_css'),
('STUDY','Study Leave','Sec. 68, Rule XVI, EO 292','special','{regular,contractual}',true,false,null,'none',7,14,'ao1_css'),
('VAWC','10-Day VAWC Leave','RA 9262','special','{regular,contractual}',true,false,10,'none',null,null,'ao1_css'),
('REHAB','Rehabilitation Privilege','Sec. 55, Rule XVI, EO 292','special','{regular,contractual}',true,false,null,'none',null,null,'ao1_css'),
('SLBW','Special Leave Benefits for Women','RA 9710','special','{regular,contractual}',true,false,null,'none',7,14,'ao1_css'),
('CALAMITY','Special Emergency (Calamity) Leave','CSC MC 2, s.2012','special','{regular,contractual}',true,false,null,'none',null,null,'ao1_css'),
('ADOPT','Adoption Leave','RA 8552','special','{regular,contractual}',true,false,null,'none',7,14,'ao1_css'),
-- wellness (compensatory) — reg/contractual: lump 5, expires year-end
('WELLNESS','Wellness Leave','PSA','wellness','{regular,contractual}',true,true,5,'year_end',7,14,'ao1_css'),
-- wellness (compensatory) — COSW: grants are quarterly (1/1/1/3), expire quarter-end,
--   quota handled by the grant job, not annual_quota; AO1 certifies -> CSS approves
('WELLNESS_COSW','Wellness Leave (COSW)','PSA','wellness','{cosw}',true,true,null,'quarter_end',7,14,'ao1_css'),
-- COSW non-compensatory (unpaid -> wage deduction): SSS recommends -> CSS approves
('VL_COSW','Vacation Leave (COSW, unpaid)','PSA-IV-B Adm-1','vacation','{cosw}',false,false,null,'none',7,14,'sss_css'),
('SL_COSW','Sick Leave (COSW, unpaid)','PSA-IV-B Adm-1','sick','{cosw}',false,false,null,'none',null,null,'sss_css');

-- ---------- signatory seats ----------
-- Three seats are real employees who log in and act in-app:
--   AO1/HRMO : Olivia J. Jasmin   (most likely to change; NB: two staff are "AO I" —
--              only Jasmin holds this certifying seat, not Cuadrasal)
--   CSS      : Gemma N. Opis      (stable)
--   SSS      : Orlando L. Mercene (stable; COSW recommender)
-- The RD is EXTERNAL — processes leave at the Regional Office, never logs in here.
-- Store by name only, with a retirement reminder (~Nov 2026):
-- insert into signatory_seats (seat, holder_name, is_external, reminder_date, reminder_note)
-- values ('rd','Leni R. Rioflorido', true, '2026-11-01', 'RD retiring Nov 2026 — update successor');
-- Wire the three internal seats once employee rows exist, e.g.:
-- insert into signatory_seats (seat, employee_id)
--   select 'css', id from employees where last_name='Opis' and first_name like 'Gemma%';
