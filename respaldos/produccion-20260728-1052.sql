PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  balance       INTEGER NOT NULL DEFAULT 0,   -- saldo en unidades enteras (la ruleta usa montos enteros)
  is_admin      INTEGER NOT NULL DEFAULT 0,   -- 0 = jugador, 1 = administrador
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
, role            TEXT    NOT NULL DEFAULT 'player', status          TEXT    NOT NULL DEFAULT 'active', phone           TEXT, cedula          TEXT, payout_method   TEXT, payout_details  TEXT, held_balance    INTEGER NOT NULL DEFAULT 0, credit_balance  INTEGER NOT NULL DEFAULT 0, commission_pct  REAL    NOT NULL DEFAULT 0, cashier_id      INTEGER, wagered_total   INTEGER NOT NULL DEFAULT 0, deposited_total INTEGER NOT NULL DEFAULT 0, first_name TEXT, last_name  TEXT, email      TEXT, bank       TEXT, doc_type TEXT, referral_code TEXT, created_by   INTEGER, affiliated_at TEXT, collect_details TEXT, risk_share_pct  REAL NOT NULL DEFAULT 0);
INSERT INTO "users" ("id","username","password_hash","balance","is_admin","created_at","role","status","phone","cedula","payout_method","payout_details","held_balance","credit_balance","commission_pct","cashier_id","wagered_total","deposited_total","first_name","last_name","email","bank","doc_type","referral_code","created_by","affiliated_at","collect_details","risk_share_pct") VALUES(2,'admin','pbkdf2$100000$cus6rI/30uZ0Iv95XSpHQA==$zXe7c+m4wxJFqGO9y7r3pv7hLiezY4jj4y2Go9GtOfQ=',0,1,'2026-05-20 16:28:56','admin','active',NULL,NULL,NULL,NULL,0,0,0,NULL,3978,6500,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0);
INSERT INTO "users" ("id","username","password_hash","balance","is_admin","created_at","role","status","phone","cedula","payout_method","payout_details","held_balance","credit_balance","commission_pct","cashier_id","wagered_total","deposited_total","first_name","last_name","email","bank","doc_type","referral_code","created_by","affiliated_at","collect_details","risk_share_pct") VALUES(8,'prueba','pbkdf2$100000$VFVgO+IztqK11XrggO9Jvw==$ei3heBdLxuIlDDQGFAyJ8YYhSVqMYBfWpxKzrqTJFMw=',6500,0,'2026-07-27 15:15:19','player','active','04140000000','V-00000001','pago_movil','0134 - Banesco 04140000000',0,0,0,NULL,66885,14200,'Prueba','Casa','prueba@casa.com','0134 - Banesco','V',NULL,NULL,NULL,NULL,0);
CREATE TABLE transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  type       TEXT    NOT NULL,   -- 'deposit' | 'bet' | 'win'
  amount     INTEGER NOT NULL,   -- siempre positivo; el signo lo da 'type'
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')), actor_id INTEGER, ref_id   INTEGER, source   TEXT, game_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(215,8,'deposit',5000,'Saldo inicial para pruebas','2026-07-27 15:15:56',2,NULL,'admin',NULL);
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(216,8,'bet',100,'Apuesta ronda (1 fichas)','2026-07-27 15:16:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(217,8,'win',200,'Ganancia ronda (salió 30)','2026-07-27 15:16:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(218,8,'bet',10,'Apuesta ronda (2 fichas)','2026-07-27 15:20:11',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(219,8,'bet',15,'Apuesta ronda (3 fichas)','2026-07-27 15:25:09',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(220,8,'adjust',4925,'+4925 — Cuadrar a 10.000 para seguir probando (admin)','2026-07-27 16:02:57',2,NULL,'admin',NULL);
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(221,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:11:12',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(222,8,'win',3000,'Ganancia ronda (salió 18)','2026-07-27 16:11:12',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(223,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:11:45',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(224,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:12:14',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(225,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:12:44',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(226,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:13:14',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(227,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:13:47',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(228,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:14:17',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(229,8,'win',3000,'Ganancia ronda (salió 22)','2026-07-27 16:14:17',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(230,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:14:52',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(231,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:15:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(232,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:15:53',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(233,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:16:43',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(234,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:17:16',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(235,8,'win',3000,'Ganancia ronda (salió 30)','2026-07-27 16:17:16',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(236,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:17:49',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(237,8,'win',3000,'Ganancia ronda (salió 21)','2026-07-27 16:17:49',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(238,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:18:35',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(239,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:19:05',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(240,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:19:39',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(241,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:20:25',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(242,8,'win',7500,'Ganancia ronda (salió 17)','2026-07-27 16:20:25',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(243,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:20:57',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(244,8,'bet',1000,'Apuesta ronda (10 fichas)','2026-07-27 16:21:27',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(245,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:24:15',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(246,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:25:33',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(247,8,'win',3000,'Ganancia ronda (salió 31)','2026-07-27 16:25:33',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(248,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:26:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(249,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:26:54',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(250,8,'win',150,'Ganancia ronda (salió 3)','2026-07-27 16:26:54',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(251,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:27:25',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(252,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:27:55',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(253,8,'win',3000,'Ganancia ronda (salió 31)','2026-07-27 16:27:56',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(254,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:28:26',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(255,8,'win',150,'Ganancia ronda (salió 11)','2026-07-27 16:28:26',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(256,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:28:56',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(257,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:29:30',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(258,8,'win',3000,'Ganancia ronda (salió 2)','2026-07-27 16:29:30',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(259,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:29:58',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(260,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:30:26',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(261,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:30:56',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(262,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:31:35',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(263,8,'win',5000,'Ganancia ronda (salió 33)','2026-07-27 16:31:35',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(264,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:32:05',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(265,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:32:35',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(266,8,'win',3000,'Ganancia ronda (salió 35)','2026-07-27 16:32:35',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(267,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:36:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(268,8,'win',150,'Ganancia ronda (salió 5)','2026-07-27 16:36:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(269,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:36:37',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(270,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:37:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(271,8,'win',150,'Ganancia ronda (salió 16)','2026-07-27 16:37:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(272,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:37:42',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(273,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:38:30',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(274,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:39:00',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(275,8,'win',3000,'Ganancia ronda (salió 15)','2026-07-27 16:39:00',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(276,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:39:28',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(277,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:39:58',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(278,8,'win',150,'Ganancia ronda (salió 18)','2026-07-27 16:39:58',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(279,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:43:48',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(280,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:44:17',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(281,8,'win',150,'Ganancia ronda (salió 7)','2026-07-27 16:44:17',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(282,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:45:10',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(283,8,'bet',1000,'Apuesta ronda (21 fichas)','2026-07-27 16:54:26',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(284,8,'win',150,'Ganancia ronda (salió 28)','2026-07-27 16:54:26',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(285,8,'bet',1000,'Apuesta ronda (24 fichas)','2026-07-27 17:02:32',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(286,8,'win',150,'Ganancia ronda (salió 17)','2026-07-27 17:02:32',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(287,8,'bet',1000,'Apuesta ronda (24 fichas)','2026-07-27 17:03:14',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(288,8,'bet',1000,'Apuesta ronda (24 fichas)','2026-07-27 17:07:21',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(289,8,'bet',1000,'Apuesta ronda (24 fichas)','2026-07-27 17:11:13',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(290,8,'win',750,'Ganancia ronda (salió 18)','2026-07-27 17:11:14',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(291,8,'bet',100,'Apuesta ronda (1 fichas)','2026-07-27 17:12:16',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(292,8,'bet',5,'Apuesta ronda (1 fichas)','2026-07-27 17:12:46',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(293,8,'bet',500,'Apuesta ronda (8 fichas)','2026-07-27 17:14:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(294,8,'win',3000,'Ganancia ronda (salió 22)','2026-07-27 17:14:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(295,8,'bet',500,'Apuesta ronda (8 fichas)','2026-07-27 17:15:02',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(296,8,'bet',500,'Apuesta ronda (8 fichas)','2026-07-27 17:15:32',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(297,8,'bet',500,'Apuesta ronda (8 fichas)','2026-07-27 17:16:02',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(298,8,'bet',500,'Apuesta ronda (8 fichas)','2026-07-27 17:16:35',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(299,8,'bet',10,'Apuesta ronda (2 fichas)','2026-07-27 17:17:09',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(300,8,'win',10,'Ganancia ronda (salió 36)','2026-07-27 17:17:09',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(301,8,'bet',15,'Apuesta ronda (3 fichas)','2026-07-27 17:43:36',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(302,8,'win',15,'Ganancia ronda (salió 23)','2026-07-27 17:43:36',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(303,8,'bet',5,'Apuesta ronda (1 fichas)','2026-07-27 17:44:46',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(304,8,'bet',15,'Apuesta ronda (3 fichas)','2026-07-27 17:45:54',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(305,8,'win',15,'Ganancia ronda (salió 30)','2026-07-27 17:45:54',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(306,8,'bet',15,'Apuesta ronda (3 fichas)','2026-07-27 17:46:26',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(307,8,'win',15,'Ganancia ronda (salió 19)','2026-07-27 17:46:26',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(308,8,'bet',15,'Apuesta ronda (3 fichas)','2026-07-27 17:46:57',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(309,8,'win',15,'Ganancia ronda (salió 9)','2026-07-27 17:46:57',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(310,8,'bet',10,'Apuesta ronda (2 fichas)','2026-07-27 17:49:27',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(311,8,'win',10,'Ganancia ronda (salió 33)','2026-07-27 17:49:27',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(312,8,'bet',10,'Apuesta ronda (2 fichas)','2026-07-27 17:50:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(313,8,'win',10,'Ganancia ronda (salió 11)','2026-07-27 17:50:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(314,8,'bet',570,'Apuesta ronda (18 fichas)','2026-07-27 17:59:41',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(315,8,'bet',30,'Apuesta ronda (2 fichas)','2026-07-27 18:01:36',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(316,8,'win',10,'Ganancia ronda (salió 15)','2026-07-27 18:01:36',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(317,8,'bet',30,'Apuesta ronda (2 fichas)','2026-07-27 18:02:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(318,8,'win',50,'Ganancia ronda (salió 21)','2026-07-27 18:02:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(319,8,'bet',30,'Apuesta ronda (2 fichas)','2026-07-27 18:02:37',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(320,8,'win',50,'Ganancia ronda (salió 27)','2026-07-27 18:02:37',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(321,8,'bet',30,'Apuesta ronda (2 fichas)','2026-07-27 18:03:05',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(322,8,'win',10,'Ganancia ronda (salió 15)','2026-07-27 18:03:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(323,8,'bet',30,'Apuesta ronda (2 fichas)','2026-07-27 18:03:44',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(324,8,'win',50,'Ganancia ronda (salió 19)','2026-07-27 18:03:44',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(325,8,'bet',30,'Apuesta ronda (2 fichas)','2026-07-27 18:04:16',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(326,8,'win',50,'Ganancia ronda (salió 19)','2026-07-27 18:04:16',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(327,8,'bet',30,'Apuesta ronda (2 fichas)','2026-07-27 18:04:52',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(328,8,'win',50,'Ganancia ronda (salió 7)','2026-07-27 18:04:52',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(329,8,'bet',100,'Apuesta ronda (1 fichas)','2026-07-27 18:21:27',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(330,8,'win',200,'Ganancia ronda (salió 5)','2026-07-27 18:21:27',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(331,8,'bet',100,'Apuesta ronda (1 fichas)','2026-07-27 18:23:19',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(332,8,'win',200,'Ganancia ronda (salió 3)','2026-07-27 18:23:19',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(333,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:35:08',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(334,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:35:36',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(335,8,'win',30,'Ganancia ronda (salió 7)','2026-07-27 20:35:36',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(336,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:37:02',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(337,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:37:35',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(338,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:38:16',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(339,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:38:46',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(340,8,'win',30,'Ganancia ronda (salió 20)','2026-07-27 20:38:46',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(341,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:39:45',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(342,8,'win',30,'Ganancia ronda (salió 21)','2026-07-27 20:39:45',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(343,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:40:17',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(344,8,'win',30,'Ganancia ronda (salió 11)','2026-07-27 20:40:17',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(345,8,'bet',80,'Apuesta ronda (16 fichas)','2026-07-27 20:40:55',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(346,8,'bet',130,'Apuesta ronda (18 fichas)','2026-07-27 20:42:21',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(347,8,'deposit',9200,'Carga manual (admin)','2026-07-27 21:22:57',2,NULL,'admin',NULL);
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(348,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:31:36',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(349,8,'win',180,'Ganancia ronda (salió 33)','2026-07-27 21:31:36',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(350,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:32:39',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(351,8,'win',180,'Ganancia ronda (salió 6)','2026-07-27 21:32:39',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(352,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:33:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(353,8,'win',180,'Ganancia ronda (salió 7)','2026-07-27 21:33:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(354,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:34:09',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(355,8,'win',30,'Ganancia ronda (salió 26)','2026-07-27 21:34:09',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(356,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:34:39',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(357,8,'win',30,'Ganancia ronda (salió 25)','2026-07-27 21:34:39',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(358,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:35:40',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(359,8,'win',30,'Ganancia ronda (salió 2)','2026-07-27 21:35:40',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(360,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:36:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(361,8,'win',30,'Ganancia ronda (salió 27)','2026-07-27 21:36:22',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(362,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:37:19',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(363,8,'win',30,'Ganancia ronda (salió 26)','2026-07-27 21:37:19',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(364,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:38:48',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(365,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:39:28',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(366,8,'win',30,'Ganancia ronda (salió 12)','2026-07-27 21:39:29',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(367,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:41:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(368,8,'win',30,'Ganancia ronda (salió 8)','2026-07-27 21:41:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(369,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:42:21',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(370,8,'win',180,'Ganancia ronda (salió 19)','2026-07-27 21:42:21',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(371,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:42:59',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(372,8,'win',180,'Ganancia ronda (salió 13)','2026-07-27 21:42:59',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(373,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:43:28',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(374,8,'win',30,'Ganancia ronda (salió 2)','2026-07-27 21:43:28',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(375,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:43:59',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(376,8,'win',30,'Ganancia ronda (salió 20)','2026-07-27 21:44:00',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(377,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:44:50',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(378,8,'win',180,'Ganancia ronda (salió 31)','2026-07-27 21:44:50',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(379,8,'bet',100,'Apuesta ronda (56 fichas)','2026-07-27 21:45:24',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(380,8,'win',30,'Ganancia ronda (salió 8)','2026-07-27 21:45:24',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(381,8,'bet',50,'Apuesta ronda (10 fichas)','2026-07-27 21:47:28',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(382,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:49:33',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(383,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:50:33',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(384,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:51:27',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(385,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:55:23',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(386,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:56:06',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(387,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:57:10',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(388,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:58:41',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(389,8,'win',150,'Ganancia ronda (salió 30)','2026-07-27 21:58:41',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(390,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:59:17',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(391,8,'win',150,'Ganancia ronda (salió 20)','2026-07-27 21:59:18',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(392,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 21:59:50',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(393,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 22:00:34',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(394,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 22:01:18',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(395,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 22:02:43',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(396,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 22:03:29',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(397,8,'win',150,'Ganancia ronda (salió 12)','2026-07-27 22:03:29',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(398,8,'bet',100,'Apuesta ronda (12 fichas)','2026-07-27 22:04:15',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(399,8,'bet',100,'Apuesta ronda (8 fichas)','2026-07-27 22:06:15',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(400,8,'bet',100,'Apuesta ronda (8 fichas)','2026-07-27 22:06:59',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(401,8,'bet',100,'Apuesta ronda (8 fichas)','2026-07-27 22:07:50',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(402,8,'bet',100,'Apuesta ronda (8 fichas)','2026-07-27 22:09:01',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(403,8,'bet',100,'Apuesta ronda (8 fichas)','2026-07-27 22:09:35',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(404,8,'bet',100,'Apuesta ronda (8 fichas)','2026-07-27 22:10:20',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(405,8,'bet',100,'Apuesta ronda (8 fichas)','2026-07-27 22:11:20',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(406,8,'win',150,'Ganancia ronda (salió 23)','2026-07-27 22:11:20',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(407,8,'bet',130,'Apuesta ronda (6 fichas)','2026-07-27 22:13:03',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(408,8,'win',150,'Ganancia ronda (salió 7)','2026-07-27 22:13:03',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(409,8,'bet',130,'Apuesta ronda (6 fichas)','2026-07-27 22:13:43',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(410,8,'bet',80,'Apuesta ronda (12 fichas)','2026-07-27 22:19:58',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(411,8,'bet',40,'Apuesta ronda (4 fichas)','2026-07-28 13:48:58',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(412,8,'bet',100,'Apuesta ronda (4 fichas)','2026-07-28 13:50:02',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(413,8,'win',750,'Ganancia ronda (salió 8)','2026-07-28 13:50:02',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(414,8,'bet',100,'Apuesta ronda (4 fichas)','2026-07-28 13:51:29',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(415,8,'bet',100,'Apuesta ronda (4 fichas)','2026-07-28 13:55:03',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(416,8,'bet',275,'Apuesta ronda (11 fichas)','2026-07-28 13:56:26',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(417,8,'bet',325,'Apuesta ronda (13 fichas)','2026-07-28 13:57:16',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(418,8,'win',750,'Ganancia ronda (salió 31)','2026-07-28 13:57:16',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(419,8,'bet',350,'Apuesta ronda (14 fichas)','2026-07-28 13:59:02',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(420,8,'bet',4050,'Apuesta ronda (162 fichas)','2026-07-28 14:06:49',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(421,8,'win',2700,'Ganancia ronda (salió 19)','2026-07-28 14:06:49',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(422,8,'bet',75,'Apuesta ronda (3 fichas)','2026-07-28 14:08:30',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(423,8,'bet',25,'Apuesta ronda (1 fichas)','2026-07-28 14:10:39',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(424,8,'bet',2600,'Apuesta ronda (104 fichas)','2026-07-28 14:15:13',NULL,NULL,'game','catatumbo');
INSERT INTO "transactions" ("id","user_id","type","amount","note","created_at","actor_id","ref_id","source","game_id") VALUES(425,8,'win',2400,'Ganancia ronda (salió 3)','2026-07-28 14:15:13',NULL,NULL,'game','catatumbo');
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER
);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('rate_usd','40','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('max_bet_per_spin','500','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('max_win_per_spin','50000','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('min_topup','100','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('min_withdrawal','500','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('wager_pct_required','50','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('registration_open','1','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('bank_pago_movil','Configurá acá los datos de tu Pago Móvil','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('bank_transferencia','Configurá acá tu cuenta bancaria','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('bank_zelle','Configurá acá tu correo de Zelle','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('bank_binance','Configurá acá tu usuario de Binance','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('bank_p2p','Configurá acá tus datos P2P (Binance u otro)','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('cupo_alert','2000','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('max_bet_casilla','500','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('max_bet_pleno','100','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('ltg_min','1','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('ltg_max','4','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('ltg_pesos','46.4,25,13.5,7.3,3.9,2.1,1.1,0.6','2026-07-27 16:58:53',2);
INSERT INTO "settings" ("key","value","updated_at","updated_by") VALUES('monto_multiplo','100','2026-07-27 16:58:53',2);
CREATE TABLE topups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  amount      INTEGER NOT NULL,           -- monto en bolívares a acreditar
  currency    TEXT    NOT NULL DEFAULT 'BS',  -- BS | USD
  amount_fx   REAL,                       -- monto original si vino en divisa
  rate        REAL,                       -- tasa usada en la conversión
  method      TEXT    NOT NULL,           -- pago_movil | transferencia | zelle | binance
  reference   TEXT,                       -- número de referencia o hash
  status      TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  note        TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')), cashier_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE withdrawals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  method      TEXT    NOT NULL,           -- pago_movil | transferencia | zelle | binance
  destination TEXT,                       -- a dónde se le paga (teléfono, cuenta, correo)
  cedula      TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending', -- pending | paid | rejected
  paid_by     TEXT,                       -- owner | cashier
  payer_id    INTEGER,                    -- taquillero que pagó, si aplica
  note        TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')), cashier_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE credit_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id  INTEGER NOT NULL,
  type        TEXT    NOT NULL,   -- purchase | load | withdrawal_refill | adjust
  amount      INTEGER NOT NULL,   -- positivo suma cupo, negativo lo consume
  paid_amount INTEGER,            -- lo que el taquillero pagó (solo en 'purchase')
  player_id   INTEGER,            -- jugador afectado (en 'load' y 'withdrawal_refill')
  ref_id      INTEGER,            -- id del retiro, si aplica
  note        TEXT,
  actor_id    INTEGER,            -- quién registró el movimiento
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cashier_id) REFERENCES users(id)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('users',8);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('transactions',425);
CREATE INDEX idx_tx_user    ON transactions(user_id, created_at DESC);
CREATE INDEX idx_tx_recent  ON transactions(created_at DESC);
CREATE INDEX idx_users_name ON users(username);
CREATE INDEX idx_users_role    ON users(role);
CREATE INDEX idx_users_cashier ON users(cashier_id);
CREATE INDEX idx_tx_type ON transactions(type, created_at DESC);
CREATE INDEX idx_topups_status ON topups(status, created_at DESC);
CREATE INDEX idx_topups_user   ON topups(user_id, created_at DESC);
CREATE INDEX idx_wd_status ON withdrawals(status, created_at DESC);
CREATE INDEX idx_wd_user   ON withdrawals(user_id, created_at DESC);
CREATE INDEX idx_ledger_cashier ON credit_ledger(cashier_id, created_at DESC);
CREATE INDEX idx_ledger_recent  ON credit_ledger(created_at DESC);
CREATE UNIQUE INDEX idx_users_cedula ON users(cedula);
CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_last_name ON users(last_name);
CREATE INDEX idx_users_doc_type ON users(doc_type);
CREATE UNIQUE INDEX idx_users_referral ON users(referral_code);
CREATE INDEX idx_topups_cashier ON topups(cashier_id, status);
CREATE INDEX idx_wd_cashier     ON withdrawals(cashier_id, status);
CREATE INDEX idx_tx_game ON transactions(game_id, created_at DESC);
