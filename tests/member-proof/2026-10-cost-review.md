# Monthly AWS cost review — Customer A (redacted), October 2026
Prepared by: delivery engineer (name redacted) · Reviewed by: MSP delivery lead · Time to prepare: about 3 hours
Accounts: 111111111111 (prod), 222222222222 (non-prod) · Period: 2026-10-01 to 2026-10-31 · Source: Cost Explorer export, CloudWatch CPU (Grafana panel)

| # | Finding | Monthly impact (USD) | Evidence | Decision |
|---|---|---|---|---|
| 1 | 4 idle m6i.xlarge in non-prod (CPU < 3% for 30 days) | 560 identified | Grafana panel, 30-day CPU | Accepted: ticket OPS-412 |
| 2 | gp2 volumes not migrated to gp3 (38 volumes) | 210 identified | Cost Explorer by usage type | Accepted: ticket OPS-413 |
| 3 | Savings Plan recommendation for 1-year compute | 1,900 identified | Cost Explorer recommendation | Dismissed: customer will not commit before Q1 |
| 4 | NAT gateway data processing up 40% month on month | 330 identified | Cost Explorer by service | Accepted: investigate, ticket OPS-414 |
| 5 | Reserved Instance recommendation under 50 USD/month | 35 identified | Cost Explorer | Dismissed: below our 50 USD threshold |

Realised from September's actions: 410 USD (confirmed on October's bill). Identified is not realised.
