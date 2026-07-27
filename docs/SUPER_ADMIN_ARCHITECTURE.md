# AutoPublisher 總營運中心 (Super Admin Dashboard) 實作架構

本文件詳細規劃了 AutoPublisher 「總營運中心 / 背控中心」的系統架構。此系統專為平台方（Platform Owner）設計，旨在與現有的 B2B 場館端系統（Venue Dashboard）進行物理隔離，提供宏觀的生態系管理、廣告變現控制與系統監控能力。

## 1. 系統定位與架構隔離 (System Architecture)

總營運中心採用 **RBAC (Role-Based Access Control)** 權限模型，與現有的 B2B 架構分離：
*   **API 路由隔離**：後端新增獨立的 `/api/superadmin/*` 路由叢集，並強制校驗 `role === 'SUPER_ADMIN'`，阻擋任何場館方 API Key 或 Token 的存取。
*   **前端介面隔離**：專屬的 UI/UX 設計，以「數據儀表板」與「聯播網管理」為核心，有別於 B2B 的「操作導向」。建立專屬路由 `/superadmin`。

---

## 2. 五大核心模組設計 (Core Modules)

### 模組一：全域廣告聯播網引擎 (Global Ad Network Engine)
這是平台的變現核心，允許營運方將品牌廣告推播至全台場館。
*   **廣告活動管理 (Ad Campaigns)**：支援管理包含多張全域廣告的專案。
*   **權重與頻率控制 (Weight Control)**：強制推播至全台合作場館。
*   **排程系統 (Scheduling)**：預先設定廣告活動的開始與結束時間 (`startDate`, `endDate`)。

### 模組二：場館與生態系管理 (Venue Partner Management)
管理所有使用 AutoPublisher 系統的線下場館。
*   **場館 CRUD**：新增、停用、編輯場館基本資料。
*   **帳號與權限核發**：為新的合作場館生成 B2B 後台的登入帳號。

### 模組三：跨場館數據總匯與商業分析 (Cross-Venue Analytics)
為品牌主提供結案報告的數據來源。
*   **宏觀漏斗分析**：追蹤全台總觸及人數、總掃碼次數。
*   **全域廣告成效追蹤 (CTR)**：記錄點擊與曝光。

### 模組四：系統引擎與爬蟲監控 (System Health & Scraper Monitor)
監控自動化工具的健康度，確保內容供應不斷鏈。

### 模組五：全域參數動態配置 (Global Config Engine)
動態調整時間鎖預設值與全域設定。

---

## 3. 資料庫擴充需求 (Database Schema Updates)

#### [NEW] `AdCampaign` (廣告活動模型)
用於管理全域廣告的排程與預算。
```prisma
model AdCampaign {
  id          String   @id @default(uuid())
  title       String
  sponsor     String   // 廣告主 (e.g., Netflix)
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean  @default(true)
  targetVenues String? // JSON Array of Venue IDs, null = 全區聯播
  ads         Advertisement[] 
  createdAt   DateTime @default(now())
}
```

#### [MODIFY] `Advertisement` (現有廣告模型擴充)
```prisma
model Advertisement {
  // ... existing fields ...
  campaignId  String?
  campaign    AdCampaign? @relation(fields: [campaignId], references: [id])
  clickCount  Int         @default(0)
  viewCount   Int         @default(0)
}
```

#### [MODIFY] `Venue` (現場場館模型擴充)
```prisma
model Venue {
  // ... existing fields ...
  contactName  String?
  contactPhone String?
  status       String   @default("ACTIVE") // ACTIVE, SUSPENDED
}
```
