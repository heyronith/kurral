# Adding IONOS Domain to Vercel - Step by Step Guide

## Overview
This guide will help you connect your `kurral.online` domain (purchased from IONOS) to your Vercel deployment.

---

## Step 1: Add Domain in Vercel Dashboard

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your **kurral** project

2. **Navigate to Domain Settings**
   - Click on **Settings** tab
   - Click on **Domains** in the left sidebar

3. **Add Your Domain**
   - Click the **Add** button
   - Enter: `kurral.online`
   - Click **Add**

4. **Vercel will show you DNS configuration options**
   - You'll see two options:
     - **Option A**: Use Vercel Nameservers (Recommended - easier)
     - **Option B**: Configure DNS records manually in IONOS

---

## Step 2A: Using Vercel Nameservers (Recommended - Easier)

### In Vercel:
1. After adding the domain, Vercel will show you **4 nameservers** like:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
   - etc.

### In IONOS:
1. **Log in to IONOS**
   - Go to: https://www.ionos.com/
   - Log in to your account

2. **Navigate to Domain Management**
   - Go to **Domains & SSL** → **Domains**
   - Click on **kurral.online**

3. **Change Nameservers**
   - Click on **DNS** or **Nameservers** tab
   - Select **Custom Nameservers** or **Use Custom Nameservers**
   - Delete the existing nameservers
   - Add the 4 nameservers provided by Vercel:
     ```
     ns1.vercel-dns.com
     ns2.vercel-dns.com
     ns3.vercel-dns.com
     ns4.vercel-dns.com
     ```
   - **Save** the changes

4. **Wait for Propagation**
   - DNS changes can take 5 minutes to 48 hours
   - Usually completes within 1-2 hours

5. **Back in Vercel**
   - Vercel will automatically detect the nameserver change
   - SSL certificate will be automatically issued
   - Domain will be ready when status shows "Valid Configuration"

---

## Step 2B: Using Manual DNS Records (Alternative Method)

If you prefer to keep IONOS nameservers, use this method:

### In Vercel:
1. After adding the domain, Vercel will show you DNS records to add:
   - **A Record**: `76.76.21.21` (or similar IP)
   - **CNAME Record** for `www`: `cname.vercel-dns.com`
   - **TXT Record** for verification (if required)

### In IONOS:
1. **Log in to IONOS**
   - Go to **Domains & SSL** → **Domains**
   - Click on **kurral.online**

2. **Go to DNS Settings**
   - Click on **DNS** tab
   - Click **Add Record** or **Edit DNS**

3. **Add A Record** (for root domain):
   - **Type**: A
   - **Name**: `@` or leave blank (for root domain)
   - **Value/Points to**: `76.76.21.21` (use the IP Vercel provides)
   - **TTL**: 3600 (or default)
   - **Save**

4. **Add CNAME Record** (for www subdomain - optional):
   - **Type**: CNAME
   - **Name**: `www`
   - **Value/Points to**: `cname.vercel-dns.com` (use what Vercel provides)
   - **TTL**: 3600 (or default)
   - **Save**

5. **Add TXT Record** (if Vercel requires verification):
   - **Type**: TXT
   - **Name**: `@` or leave blank
   - **Value**: (copy the exact value from Vercel)
   - **TTL**: 3600 (or default)
   - **Save**

6. **Wait for DNS Propagation**
   - Can take 5 minutes to 48 hours
   - Usually completes within 1-2 hours

7. **Back in Vercel**
   - Vercel will automatically verify the DNS records
   - SSL certificate will be issued automatically
   - Domain status will show "Valid Configuration"

---

## Step 3: Verify Domain is Working

1. **Check Domain Status in Vercel**
   - Go to **Settings** → **Domains**
   - Status should show: ✅ **Valid Configuration**

2. **Test Your Domain**
   - Visit: `https://kurral.online` (should show your app)
   - Visit: `https://kurral.online/lp` (should show landing page)
   - Check that SSL certificate is active (padlock icon in browser)

3. **If Domain Shows "Pending" or "Invalid Configuration"**
   - Wait a bit longer (DNS propagation takes time)
   - Double-check DNS records match exactly what Vercel shows
   - Make sure there are no typos in nameservers or DNS records

---

## Troubleshooting

### Domain Not Working After 24 Hours

1. **Check DNS Propagation**
   - Use: https://dnschecker.org/
   - Enter: `kurral.online`
   - Check if DNS records are propagated globally

2. **Verify DNS Records in IONOS**
   - Make sure records are saved correctly
   - Check for typos
   - Ensure TTL is set (not 0)

3. **Check Vercel Dashboard**
   - Look for any error messages
   - Check if domain verification is pending

### SSL Certificate Not Issuing

- Vercel automatically issues SSL certificates
- If it's taking too long, try:
  - Removing and re-adding the domain in Vercel
  - Waiting a bit longer (can take up to 24 hours)

### www Subdomain Not Working

- Make sure you added the CNAME record for `www`
- Or add `www.kurral.online` as a separate domain in Vercel

---

## Quick Reference: IONOS DNS Settings Location

1. Log in to IONOS
2. **Domains & SSL** → **Domains**
3. Click on **kurral.online**
4. Click on **DNS** tab
5. Here you can:
   - Change nameservers
   - Add/edit DNS records (A, CNAME, TXT, etc.)

---

## Need Help?

- **IONOS Support**: https://www.ionos.com/help/
- **Vercel Documentation**: https://vercel.com/docs/concepts/projects/domains
- **Vercel Support**: Available in dashboard or support@vercel.com

---

## Expected Timeline

- **DNS Propagation**: 5 minutes to 48 hours (usually 1-2 hours)
- **SSL Certificate**: Automatically issued by Vercel (usually within minutes after DNS is ready)
- **Total Setup Time**: Typically 1-3 hours, can take up to 48 hours in rare cases

