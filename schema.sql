-- A300 공정 데이터 관리 시스템 스키마 (SQLite 참조 구현)
-- 앱은 IndexedDB 를 사용하며, 아래는 동일 구조의 관계형 정의이다.

CREATE TABLE batches (
  id      TEXT PRIMARY KEY,              -- 'YYYY-MM-DD|탱크'
  ton    REAL ,   -- 톤수(ton) [공통]
  tt     REAL ,   -- 발효탱크 설정TT(℃) [온도]
  milk   REAL ,   -- 살균유 측정온도(℃) [온도]
  t1     REAL ,   -- 1H 발효액 온도(℃) [온도]
  t5     REAL ,   -- 5H 발효액 온도(℃) [온도]
  amb    REAL ,   -- 발효실 실내온도(℃) [온도]
  cool   REAL ,   -- 살균냉각온도(℃) [설정]
  hot    REAL ,   -- 핫워터 설정온도(℃) [설정]
  a0     REAL ,   -- 산도 살균후(%) [산도]
  a1     REAL ,   -- 산도 접종후(1H)(%) [산도]
  a5     REAL ,   -- 산도 1차샘플(5H)(%) [산도]
  aF     REAL ,   -- 산도 종결(%) [산도]
  afm    REAL ,   -- 종결분(접종후 경과)(분) [산도]
  trans  REAL ,   -- 총이송(m) [산도]
  asS    REAL ,   -- 산도 서지1(%) [산도]
  asP    REAL ,   -- 산도 완제품1(%) [산도]
  vs1    REAL ,   -- 점도 1차 [점도]
  vsF    REAL ,   -- 점도 종결 [점도]
  vsS    REAL ,   -- 점도 서지1 [점도]
  vsP    REAL ,   -- 점도 완제품1 [점도]
  ph0    REAL ,   -- pH 살균후 [pH]
  ph1    REAL ,   -- pH 접종후(1H) [pH]
  ph5    REAL ,   -- pH 1차(5H) [pH]
  phF    REAL ,   -- pH 종결 [pH]
  phS    REAL ,   -- pH 서지1 [pH]
  phP    REAL ,   -- pH 완제품1 [pH]
  br0    REAL ,   -- 당도 살균후(°Bx) [당도]
  br1    REAL ,   -- 당도 접종후(1H)(°Bx) [당도]
  brF    REAL ,   -- 당도 종결(°Bx) [당도]
  brS    REAL ,   -- 당도 서지1(°Bx) [당도]
  brP    REAL ,   -- 당도 완제품1(°Bx) [당도]
  date    TEXT NOT NULL,
  tank    TEXT NOT NULL,
  mins    REAL GENERATED ALWAYS AS (afm - 300) VIRTUAL,
  note    TEXT,
  src     TEXT,                          -- seed | user | import
  ts      INTEGER                        -- 저장 시각(epoch ms)
);

CREATE INDEX idx_batches_date ON batches(date);
CREATE UNIQUE INDEX ux_batches_date_tank ON batches(date, tank);

CREATE TABLE meta (
  k TEXT PRIMARY KEY,
  v TEXT
);

-- 무결성: a1>=a0, a5>=a1, aF>=a5, afm>=300 (애플리케이션 계층에서 검증)
