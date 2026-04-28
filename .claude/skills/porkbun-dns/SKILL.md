---
name: porkbun-dns
description: Manage DNS records on Porkbun. Use when user asks to create, update, delete, or list DNS records. Requires PORKBUN_API_KEY and PORKBUN_SECRET_KEY environment variables.
---

# Porkbun DNS Management

This skill uses the Porkbun API to manage DNS records. API credentials are loaded from `.env` file in the project directory.

## Available Commands

### List all DNS records for a domain
```
!`source .env && curl -s "https://api.porkbun.com/api/json/v3/dns/retrieve/$ARGUMENTS" -H "Content-Type: application/json" -d "{\"apikey\":\"$PORKBUN_API_KEY\",\"secretapikey\":\"$PORKBUN_SECRET_KEY\""`
```

### Create a DNS record
```
!`source .env && curl -s "https://api.porkbun.com/api/json/v3/dns/create/$ARGUMENTS" -H "Content-Type: application/json" -d "{\"apikey\":\"$PORKBUN_API_KEY\",\"secretapikey\":\"$PORKBUN_SECRET_KEY\""`
```

### Delete a DNS record
```
!`source .env && curl -s "https://api.porkbun.com/api/json/v3/dns/delete/$ARGUMENTS" -H "Content-Type: application/json" -d "{\"apikey\":\"$PORKBUN_API_KEY\",\"secretapikey\":\"$PORKBUN_SECRET_KEY\""`
```

### Check API credentials
```
!`source .env && curl -s "https://api.porkbun.com/api/json/v3/ping" -H "Content-Type: application/json" -d "{\"apikey\":\"$PORKBUN_API_KEY\",\"secretapikey\":\"$PORKBUN_SECRET_KEY\""`
```

## Usage Examples

**List records for javagrant.ac.nz:**
```
/porkbun-dns list javagrant.ac.nz
```

**Create CNAME record for tools subdomain:**
```
/porkbun-dns create javagrant.ac.nz name:tools type:CNAME content:javagrant.github.io ttl:600
```

**Delete a record:**
```
/porkbun-dns delete javagrant.ac.nz record_id:542273339
```

**Verify credentials:**
```
/porkbun-dns ping
```

## Record Format for Create/Edit

When creating records, include these fields in JSON:
- `name` - subdomain (e.g., "tools" for tools.javagrant.ac.nz)
- `type` - A, AAAA, CNAME, MX, TXT, etc.
- `content` - the record value (IP, hostname, etc.)
- `ttl` - time to live in seconds (default: 600)
- `prio` - priority for MX records

## Domain Format

Always specify the full domain (e.g., `javagrant.ac.nz`, not just `javagrant`).