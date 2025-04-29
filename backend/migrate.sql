-- 备份原有数据
CREATE TABLE announcements_backup AS SELECT * FROM announcements;

-- 删除原有表
DROP TABLE announcements;

-- 创建新表
CREATE TABLE announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    display_start TIMESTAMP NOT NULL,
    display_end TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 迁移数据
INSERT INTO announcements (content, display_start, display_end, is_active, created_at)
SELECT 
    content,
    created_at as display_start,
    datetime(created_at, '+15 minutes') as display_end,
    1 as is_active,
    created_at
FROM announcements_backup;

-- 删除备份表
DROP TABLE announcements_backup; 