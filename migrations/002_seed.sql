-- Data Editor
INSERT INTO editors (id, nama, kode_identifikasi, status) VALUES
(1, 'Deni', 'ED-DN', 'aktif'),
(2, 'Finda', 'ED-FD', 'aktif'),
(3, 'Rina', 'ED-RN', 'aktif'),
(4, 'Budi', 'ED-BD', 'aktif');

-- Reset sequence editor (karena kita insert ID manual)
SELECT setval('editors_id_seq', (SELECT MAX(id) FROM editors));

-- Data Konten
INSERT INTO content (id, editor_id, platform, post_id, url, judul, tanggal_upload, status_identifikasi, tipe_video) VALUES
(1, 1, 'youtube', 'demo1', 'https://youtube.com/watch?v=demo1', 'Panduan pemupukan cabe rawit agar berbuah lebat', '2026-07-01 14:30:00', 'matched', 'long'),
(2, 2, 'instagram', 'demo2', 'https://instagram.com/p/demo2', 'Cara ampuh mengatasi hama patek pada cabe', '2026-07-03 09:15:00', 'matched', 'short'),
(3, 1, 'instagram', 'demo3', 'https://instagram.com/p/demo3', 'Rahasia semai bibit cabe 100% tumbuh subur', '2026-07-05 16:45:00', 'matched', 'short'),
(4, 3, 'facebook', 'demo4', 'https://facebook.com/demo4', 'Jarak tanam ideal untuk hasil panen cabe maksimal', '2026-07-06 13:20:00', 'matched', 'long'),
(5, 4, 'youtube', 'demo5', 'https://youtube.com/watch?v=demo5', 'Meracik pupuk organik cair khusus untuk cabe', '2026-07-08 08:00:00', 'matched', 'short'),
(6, NULL, 'instagram', 'demo6', 'https://instagram.com/p/demo6', 'Panen raya cabe merah keriting musim kemarau', '2026-07-09 10:00:00', 'unmatched', 'short');

-- Reset sequence content
SELECT setval('content_id_seq', (SELECT MAX(id) FROM content));

-- Data Metrics
INSERT INTO metrics_snapshot (content_id, views, likes, comments, timestamp) VALUES
(1, 24500, 1820, 142, NOW()),
(2, 18200, 2140, 88, NOW()),
(3, 15800, 1290, 54, NOW()),
(4, 9200, 410, 31, NOW()),
(5, 31200, 2680, 210, NOW()),
(6, 6400, 340, 12, NOW());

-- Data Affiliate Goals
INSERT INTO affiliate_goals (bulan, target_omset, tercapai) VALUES
('2026-07', 10000000, 4500000);
