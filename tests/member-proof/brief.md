# Brief for a headless run (answers a member would give)
- Role: MSP delivery lead (answers for the review being done the same way for every customer).
- Job: monthly AWS cost review per customer. Trigger: first business day of each month. Decision it supports: which savings actions the customer approves this month. Who acts: the platform engineer, through Jira tickets.
- Useful result: a finding is actionable when it has an owner, an evidence link and a monthly impact of at least 50 USD. Routinely dismissed: commitments (Savings Plans, Reserved Instances) unless the customer asked for them; anything under 50 USD/month. Always keep identified and realised savings apart.
- Minimum data: AWS Cost Explorer for the customer's accounts (here 111111111111 and 222222222222), previous calendar month; CloudWatch or Grafana CPU only to prove idle compute.
- Authority: read costs yes; draft a Jira ticket yes; file a ticket only after the delivery lead approves; never change a resource.
- Success measure: preparation time from about 3 hours to under 30 minutes, and the delivery lead accepts at least 4 of 5 findings without edits.
- Plugin name for the build: acme-cost-review. Fork name for the catalogue copy: acme-ops. NOTICE line: yes.
- Licence and author for the plugin: Apache-2.0, author "Acme MSP" (a made-up company for this test).
