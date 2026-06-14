$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host "Starting auth smoke tests against http://localhost:4000"

try {
  $r1 = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/register' -Method Post -Body (ConvertTo-Json @{email='smoke+1@example.com'; password='Password123!'; firstName='Smoke'; lastName='Test'}) -ContentType 'application/json' -WebSession $session
  Write-Host 'REGISTER: OK'
  Write-Output $r1
} catch {
  Write-Host 'REGISTER ERR:'
  if ($_.Exception.Response) { $_.Exception.Response | Format-List -Property StatusCode, StatusDescription }
  else { Write-Host $_ }
}

try {
  $r2 = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/login' -Method Post -Body (ConvertTo-Json @{email='smoke+1@example.com'; password='Password123!'}) -ContentType 'application/json' -WebSession $session
  Write-Host 'LOGIN: OK'
  Write-Output $r2
} catch {
  Write-Host 'LOGIN ERR:'
  if ($_.Exception.Response) { $_.Exception.Response | Format-List -Property StatusCode, StatusDescription }
  else { Write-Host $_ }
}

$cookies = $session.Cookies.GetCookies('http://localhost:4000')
$csrfCookie = $cookies | Where-Object { $_.Name -eq 'csrf_token' }
$csrf = if ($csrfCookie) { $csrfCookie.Value } else { '' }
Write-Host "CSRF_TOKEN=$csrf"

try {
  $r3 = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/refresh' -Method Post -Headers @{'X-CSRF-Token'=$csrf} -WebSession $session
  Write-Host 'REFRESH: OK'
  Write-Output $r3
} catch {
  Write-Host 'REFRESH ERR:'
  if ($_.Exception.Response) { $_.Exception.Response | Format-List -Property StatusCode, StatusDescription }
  else { Write-Host $_ }
}

try {
  $r4 = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/me' -Method Get -WebSession $session
  Write-Host 'ME: OK'
  Write-Output $r4
} catch {
  Write-Host 'ME ERR:'
  if ($_.Exception.Response) { $_.Exception.Response | Format-List -Property StatusCode, StatusDescription }
  else { Write-Host $_ }
}

try {
  # Re-extract csrf token after refresh (server may have rotated it)
  $cookies = $session.Cookies.GetCookies('http://localhost:4000')
  $csrfCookie = $cookies | Where-Object { $_.Name -eq 'csrf_token' }
  $csrf = if ($csrfCookie) { $csrfCookie.Value } else { '' }
  Write-Host "CSRF_AFTER_REFRESH=$csrf"

  $r5 = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/logout' -Method Post -Headers @{'X-CSRF-Token'=$csrf} -WebSession $session
  Write-Host 'LOGOUT: OK'
  Write-Output $r5
} catch {
  Write-Host 'LOGOUT ERR:'
  if ($_.Exception.Response) { $_.Exception.Response | Format-List -Property StatusCode, StatusDescription }
  else { Write-Host $_ }
}
