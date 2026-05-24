# ── SES domain identity ───────────────────────────────────────────────────────
# Verifies the root domain so any @furnitria.com address can be used as a sender.
# All required DNS records are written to Route 53 automatically — no manual
# console work is needed after `terraform apply`.

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# ── DKIM ──────────────────────────────────────────────────────────────────────
# DKIM signing improves deliverability and prevents spoofing.
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# ── Route 53 DNS records ──────────────────────────────────────────────────────
# SES domain verification TXT record
resource "aws_route53_record" "ses_verification" {
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

# DKIM CNAME records — AWS requires exactly 3
resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# ── Contact recipient email identity ─────────────────────────────────────────
# In SES sandbox mode the TO address must also be verified. This resource
# triggers a one-time verification email to ses_contact_to_address.
# ACTION REQUIRED after first apply: click the link in that verification email.
resource "aws_ses_email_identity" "contact_recipient" {
  email = var.ses_contact_to_address
}
