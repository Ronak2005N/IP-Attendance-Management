@echo off
REM Attendance System API Test Script
REM Run this script to test all endpoints

setlocal enabledelayedexpansion

echo.
echo ================================================================================
echo Attendance System - API Test Suite
echo ================================================================================
echo.

set BASE_URL=http://localhost:3000
set ADMIN_TOKEN=admin

echo.
echo [TEST 1] Get Your Client IP
echo ================================================================================
powershell -NoProfile -Command ^
  "try { ^
    $response = Invoke-WebRequest -Uri '%BASE_URL%/api/my-ip' -Method GET -UseBasicParsing; ^
    Write-Host 'Status: OK' -ForegroundColor Green; ^
    $response.Content; ^
  } catch { ^
    Write-Host 'Status: FAILED' -ForegroundColor Red; ^
    Write-Host $_.Exception.Message; ^
  }"

timeout /t 2 /nobreak

echo.
echo [TEST 2] Mark Attendance (Should be Absent - Private IP)
echo ================================================================================
powershell -NoProfile -Command ^
  "try { ^
    $body = @{ student_id = '12345'; student_name = 'John Doe' } | ConvertTo-Json; ^
    $response = Invoke-WebRequest -Uri '%BASE_URL%/api/attendance/mark' ^
      -Method POST ^
      -ContentType 'application/json' ^
      -Body $body ^
      -UseBasicParsing; ^
    Write-Host 'Status: OK' -ForegroundColor Green; ^
    $response.Content | ConvertFrom-Json | ConvertTo-Json; ^
  } catch { ^
    Write-Host 'Status: FAILED' -ForegroundColor Red; ^
    Write-Host $_.Exception.Message; ^
  }"

timeout /t 2 /nobreak

echo.
echo [TEST 3] Set Expected IP (Admin)
echo ================================================================================
powershell -NoProfile -Command ^
  "try { ^
    $body = @{ student_id = '12345'; expected_ip = '192.168.1.100' } | ConvertTo-Json; ^
    $response = Invoke-WebRequest -Uri '%BASE_URL%/api/set-expected-ip' ^
      -Method POST ^
      -Headers @{'Authorization' = 'admin'} ^
      -Body $body ^
      -ContentType 'application/json' ^
      -UseBasicParsing; ^
    Write-Host 'Status: OK' -ForegroundColor Green; ^
    $response.Content | ConvertFrom-Json | ConvertTo-Json; ^
  } catch { ^
    Write-Host 'Status: FAILED' -ForegroundColor Red; ^
    Write-Host $_.Exception.Message; ^
  }"

timeout /t 2 /nobreak

echo.
echo [TEST 4] Get Expected IP for Student
echo ================================================================================
powershell -NoProfile -Command ^
  "try { ^
    $response = Invoke-WebRequest -Uri '%BASE_URL%/api/expected-ip/12345' -Method GET -UseBasicParsing; ^
    Write-Host 'Status: OK' -ForegroundColor Green; ^
    $response.Content | ConvertFrom-Json | ConvertTo-Json; ^
  } catch { ^
    Write-Host 'Status: FAILED' -ForegroundColor Red; ^
    Write-Host $_.Exception.Message; ^
  }"

timeout /t 2 /nobreak

echo.
echo [TEST 5] Get Attendance Records (Admin)
echo ================================================================================
powershell -NoProfile -Command ^
  "try { ^
    $response = Invoke-WebRequest -Uri '%BASE_URL%/api/attendance/records' ^
      -Method GET ^
      -Headers @{'Authorization' = 'admin'} ^
      -UseBasicParsing; ^
    Write-Host 'Status: OK' -ForegroundColor Green; ^
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10; ^
  } catch { ^
    Write-Host 'Status: FAILED' -ForegroundColor Red; ^
    Write-Host $_.Exception.Message; ^
  }"

timeout /t 2 /nobreak

echo.
echo [TEST 6] Test Unauthorized Access (Without Admin Token)
echo ================================================================================
powershell -NoProfile -Command ^
  "try { ^
    $response = Invoke-WebRequest -Uri '%BASE_URL%/api/attendance/records' -Method GET -UseBasicParsing; ^
    Write-Host 'Status: FAILED (should have been unauthorized)' -ForegroundColor Red; ^
  } catch { ^
    if ($_.Exception.Response.StatusCode.Value__ -eq 401) { ^
      Write-Host 'Status: OK (correctly returned 401 Unauthorized)' -ForegroundColor Green; ^
      $response = $_.Exception.Response.GetResponseStream(); ^
      $reader = New-Object System.IO.StreamReader($response); ^
      $reader.ReadToEnd(); ^
    } else { ^
      Write-Host 'Status: FAILED (wrong error code)' -ForegroundColor Red; ^
      Write-Host $_.Exception.Message; ^
    } ^
  }"

timeout /t 2 /nobreak

echo.
echo [TEST 7] Duplicate Attendance Check
echo ================================================================================
powershell -NoProfile -Command ^
  "try { ^
    $body = @{ student_id = '12345'; student_name = 'John Doe' } | ConvertTo-Json; ^
    $response = Invoke-WebRequest -Uri '%BASE_URL%/api/attendance/mark' ^
      -Method POST ^
      -ContentType 'application/json' ^
      -Body $body ^
      -UseBasicParsing; ^
    Write-Host 'Status: OK' -ForegroundColor Green; ^
    $content = $response.Content | ConvertFrom-Json; ^
    if ($content.alreadyMarked) { ^
      Write-Host 'Duplicate detected: YES' -ForegroundColor Green; ^
    } ^
    $content | ConvertTo-Json; ^
  } catch { ^
    Write-Host 'Status: FAILED' -ForegroundColor Red; ^
    Write-Host $_.Exception.Message; ^
  }"

echo.
echo ================================================================================
echo All tests completed!
echo Check the backend terminal for detailed request logs [REQUEST_ID]
echo ================================================================================
echo.
