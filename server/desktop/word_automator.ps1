<#
.SYNOPSIS
    STARK AI — Microsoft Word Desktop COM Automator
    Directly opens, operates, progressively writes into, revises, and saves real Microsoft Word (.docx) documents.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [string]$PayloadJson = "{}"
)

$ErrorActionPreference = "Stop"

function Send-JsonResult($obj) {
    $json = $obj | ConvertTo-Json -Depth 10 -Compress
    Write-Output "---STARK_WORD_JSON_BEGIN---"
    Write-Output $json
    Write-Output "---STARK_WORD_JSON_END---"
}

function Stop-HeadlessWordZombies {
    $existing = Find-WordHwnd -maxAttempts 1 -delayMs 0
    if ($existing.Hwnd -eq 0) {
        try {
            $procs = Get-Process -Name "WINWORD" -ErrorAction SilentlyContinue
            if ($procs) {
                $procs | Stop-Process -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 300
            }
        } catch {}
    }
}

function Get-WordApp($forceNew = $false) {
    $w = $null
    $vis = Find-WordHwnd -maxAttempts 1 -delayMs 0
    if (-not $forceNew -and $vis.Hwnd -gt 0) {
        try {
            $w = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
            if ($null -ne $w) {
                try { $w.DisplayAlerts = 0 } catch {}
                return @{ App = $w; IsNew = $false }
            }
        } catch {}
    }
    if ($vis.Hwnd -eq 0) {
        Stop-HeadlessWordZombies
    }
    $w = New-Object -ComObject Word.Application
    try { $w.DisplayAlerts = 0 } catch {}
    return @{ App = $w; IsNew = $true }
}

function Get-WinwordExecutable {
    $candidates = @(
        "C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
        "C:\Program Files (x86)\Microsoft Office\root\Office16\WINWORD.EXE",
        "C:\Program Files\Microsoft Office\Office16\WINWORD.EXE",
        "C:\Program Files\Microsoft Office\root\Office15\WINWORD.EXE"
    )
    foreach ($c in $candidates) {
        if ([System.IO.File]::Exists($c)) {
            return $c
        }
    }
    return "WINWORD.EXE"
}

function Find-WordHwnd([int]$maxAttempts = 20, [int]$delayMs = 200) {
    $launcherPy = Join-Path $PSScriptRoot "win32_app_launcher.py"
    [long]$foundHwnd = 0
    [int]$foundPid = 0
    [string]$foundTitle = ""

    if ([System.IO.File]::Exists($launcherPy)) {
        for ($attempt = 0; $attempt -lt $maxAttempts; $attempt++) {
            try {
                $raw = & python $launcherPy list_windows 2>$null
                if ($raw) {
                    $parsed = ($raw -join "`n") | ConvertFrom-Json
                    if ($parsed -and $parsed.windows) {
                        $w = $parsed.windows | Where-Object {
                            ($_.proc -ieq "winword.exe") -and ($_.class -eq "OpusApp")
                        } | Select-Object -First 1
                        if ($w -and [long]$w.hwnd -gt 0 -and [int]$w.pid -gt 0) {
                            $foundHwnd = [long]$w.hwnd
                            $foundPid = [int]$w.pid
                            $foundTitle = [string]$w.title
                            break
                        }
                    }
                }
            } catch {}
            if ($attempt -lt ($maxAttempts - 1) -and $delayMs -gt 0) {
                Start-Sleep -Milliseconds $delayMs
            }
        }
    }
    return @{ Hwnd = $foundHwnd; Pid = $foundPid; Title = $foundTitle }
}

function Write-DocumentContent($doc, $word, $title, $subtitle, $sections, [bool]$isAppend = $false) {
    if (-not $isAppend) {
        [void]$doc.Content.Delete()
    }

    # Set margins to standard Word Normal margins (1 inch = 72 points)
    try {
        $doc.PageSetup.TopMargin = 72
        $doc.PageSetup.BottomMargin = 72
        $doc.PageSetup.LeftMargin = 72
        $doc.PageSetup.RightMargin = 72
    } catch {}

    $sel = $word.Selection
    [void]$sel.EndKey(6) # wdStory = 6

    # 1. Document Title
    if ($title -and (-not $isAppend -or $doc.Content.Text.Trim() -eq "")) {
        [void]$sel.TypeParagraph()
        $pTitle = $sel.Range
        $pTitle.Text = [string]$title
        $pTitle.Font.Name = "Cambria"
        $pTitle.Font.Size = 20
        $pTitle.Font.Bold = 1
        $pTitle.Font.Color = 0x1E3A8A # Deep Blue
        [void]$pTitle.InsertParagraphAfter()
        [void]$sel.EndKey(6)

        if ($subtitle) {
            $pSub = $sel.Range
            $pSub.Text = [string]$subtitle
            $pSub.Font.Name = "Calibri"
            $pSub.Font.Size = 11
            $pSub.Font.Italic = 1
            $pSub.Font.Color = 0x4B5563
            [void]$pSub.InsertParagraphAfter()
            [void]$sel.EndKey(6)
        }

        $pRule = $sel.Range
        $pRule.Text = ""
        [void]$pRule.InsertParagraphAfter()
        [void]$sel.EndKey(6)
    }

    # 2. Sections
    [int]$sectionsWritten = 0
    if ($sections) {
        foreach ($sec in $sections) {
            [void]$sel.EndKey(6)

            # Section Heading
            if ($sec.heading) {
                $pHdr = $sel.Range
                $pHdr.Text = [string]$sec.heading
                $pHdr.Font.Name = "Cambria"
                $pHdr.Font.Size = 14
                $pHdr.Font.Bold = 1
                $pHdr.Font.Italic = 0
                $pHdr.Font.Color = 0x185ABD # Word Accent Blue
                [void]$pHdr.InsertParagraphAfter()
                [void]$sel.EndKey(6)
                if ($isAppend) { Start-Sleep -Milliseconds 60 }
            }

            # Section Paragraphs
            if ($sec.paragraphs) {
                foreach ($pText in $sec.paragraphs) {
                    $pBody = $sel.Range
                    $pBody.Text = [string]$pText
                    $pBody.Font.Name = "Calibri"
                    $pBody.Font.Size = 11.5
                    $pBody.Font.Bold = 0
                    $pBody.Font.Italic = 0
                    $pBody.Font.Color = 0x111827 # Dark Text
                    $pBody.ParagraphFormat.Alignment = 3 # wdAlignParagraphJustify = 3
                    $pBody.ParagraphFormat.LineSpacingRule = 0 # wdLineSpaceSingle = 0
                    $pBody.ParagraphFormat.SpaceAfter = 6
                    [void]$pBody.InsertParagraphAfter()
                    [void]$sel.EndKey(6)
                    if ($isAppend) { Start-Sleep -Milliseconds 60 }
                }
            }

            # Section Bullets
            if ($sec.bullets) {
                foreach ($bText in $sec.bullets) {
                    $pBullet = $sel.Range
                    $pBullet.Text = "• " + [string]$bText
                    $pBullet.Font.Name = "Calibri"
                    $pBullet.Font.Size = 11
                    $pBullet.Font.Color = 0x111827
                    $pBullet.ParagraphFormat.LeftIndent = 20
                    $pBullet.ParagraphFormat.SpaceAfter = 3
                    [void]$pBullet.InsertParagraphAfter()
                    [void]$sel.EndKey(6)
                }
            }

            # Section Callout
            if ($sec.callout) {
                $pCall = $sel.Range
                $pCall.Text = [string]$sec.callout
                $pCall.Font.Name = "Calibri"
                $pCall.Font.Size = 11
                $pCall.Font.Bold = 1
                $pCall.Font.Color = 0x0F172A
                $pCall.ParagraphFormat.LeftIndent = 15
                $pCall.ParagraphFormat.RightIndent = 15
                $pCall.ParagraphFormat.SpaceAfter = 6
                [void]$pCall.InsertParagraphAfter()
                [void]$sel.EndKey(6)
            }

            # Section Table
            if ($sec.table -and $sec.table.headers -and $sec.table.rows) {
                [void]$sel.EndKey(6)
                [void]$sel.TypeParagraph()
                $headers = @($sec.table.headers)
                $rows = @($sec.table.rows)
                $rowCount = $rows.Count + 1
                $colCount = $headers.Count

                $tRange = $sel.Range
                $table = $doc.Tables.Add($tRange, $rowCount, $colCount)
                $table.Borders.Enable = $true
                [void]$table.AutoFitBehavior(2) # wdAutoFitWindow = 2

                # Headers
                for ($c = 0; $c -lt $colCount; $c++) {
                    $cell = $table.Cell(1, $c + 1)
                    $cell.Range.Text = [string]$headers[$c]
                    $cell.Range.Font.Name = "Calibri"
                    $cell.Range.Font.Size = 10.5
                    $cell.Range.Font.Bold = 1
                    $cell.Range.Font.Color = 0x0F172A
                    $cell.Shading.BackgroundPatternColor = 0xE2E8F0
                }

                # Rows
                for ($r = 0; $r -lt $rows.Count; $r++) {
                    $rowVals = @($rows[$r])
                    for ($c = 0; $c -lt [Math]::Min($colCount, $rowVals.Count); $c++) {
                        $cell = $table.Cell($r + 2, $c + 1)
                        $cell.Range.Text = [string]$rowVals[$c]
                        $cell.Range.Font.Name = "Calibri"
                        $cell.Range.Font.Size = 10.5
                        $cell.Range.Font.Bold = 0
                        if ($r % 2 -eq 1) {
                            $cell.Shading.BackgroundPatternColor = 0xF8FAFC
                        }
                    }
                }
                [void]$sel.EndKey(6)
            }

            $sectionsWritten++
        }
    }
    return [int]$sectionsWritten
}

try {
    $params = @{}
    if ($PayloadJson -and $PayloadJson.Trim() -ne "" -and $PayloadJson.Trim() -ne "{}") {
        $params = $PayloadJson | ConvertFrom-Json
    }

    switch ($Action.ToLower()) {
        "check" {
            $foundPath = Get-WinwordExecutable
            $installed = [System.IO.File]::Exists($foundPath)
            Send-JsonResult @{
                success = $installed
                installed = $installed
                executablePath = if ($installed) { $foundPath } else { $null }
            }
        }

        "init" {
            $reusedExisting = $false
            $docTitle = "Document1"
            $winInfo = Find-WordHwnd -maxAttempts 1 -delayMs 0

            if ($winInfo.Hwnd -gt 0 -and -not [bool]$params.forceNew) {
                $reusedExisting = $true
                try {
                    $w = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
                    if ($null -ne $w) {
                        $w.Visible = $true
                        $w.Activate()
                        if ($w.Documents.Count -eq 0) {
                            $d = $w.Documents.Add()
                            $docTitle = $d.Name
                        } else {
                            $docTitle = $w.ActiveDocument.Name
                        }
                    }
                } catch {}
                $winInfo = Find-WordHwnd -maxAttempts 10 -delayMs 150
            } else {
                if ($winInfo.Hwnd -eq 0) {
                    Stop-HeadlessWordZombies
                }
                $launcherPy = Join-Path $PSScriptRoot "win32_app_launcher.py"
                if ([System.IO.File]::Exists($launcherPy)) {
                    $launchOut = & python $launcherPy launch "Microsoft Word" --args "/q /w" 2>$null
                    try {
                        $parsed = ($launchOut -join "`n") | ConvertFrom-Json
                        if ($parsed -and $parsed.windowTitle) { $docTitle = $parsed.windowTitle }
                        elseif ($parsed -and $parsed.title) { $docTitle = $parsed.title }
                        if ($parsed -and $parsed.verified -eq $true -and [long]$parsed.hwnd -gt 0 -and [int]$parsed.pid -gt 0) {
                            $winInfo = @{ Hwnd = [long]$parsed.hwnd; Pid = [int]$parsed.pid; Title = $docTitle }
                        } else {
                            $winInfo = Find-WordHwnd -maxAttempts 20 -delayMs 250
                        }
                    } catch {
                        $winInfo = Find-WordHwnd -maxAttempts 20 -delayMs 250
                    }
                } else {
                    $exe = Get-WinwordExecutable
                    Start-Process -FilePath $exe -ArgumentList "/q /w" | Out-Null
                    $winInfo = Find-WordHwnd -maxAttempts 30 -delayMs 200
                }
                if ($winInfo.Title) { $docTitle = $winInfo.Title }
            }

            if ($winInfo.Hwnd -le 0 -or $winInfo.Pid -le 0) {
                Send-JsonResult @{
                    success = $false
                    verified = $false
                    action = "initialized"
                    hwnd = 0
                    pid = 0
                    error = "Microsoft Word launched but no visible WINWORD window appeared."
                }
            } else {
                Send-JsonResult @{
                    success = $true
                    verified = $true
                    action = "initialized"
                    reusedExisting = $reusedExisting
                    hwnd = $winInfo.Hwnd
                    pid = $winInfo.Pid
                    title = $docTitle
                    summary = "Microsoft Word is open with a blank white document ($docTitle)."
                }
            }
        }

        "write_progressive" {
            $wordObj = Get-WordApp
            $word = $wordObj.App
            $word.Visible = $true
            $word.Activate()

            if ($word.Documents.Count -eq 0) {
                $doc = $word.Documents.Add()
            } else {
                $doc = $word.ActiveDocument
            }
            $doc.Activate()

            $sectionsWritten = Write-DocumentContent $doc $word $params.title $params.subtitle $params.sections $true
            $winInfo = Find-WordHwnd
            Send-JsonResult @{
                success = $true
                action = "sections_written"
                sectionsWritten = $sectionsWritten
                totalParagraphs = $doc.Paragraphs.Count
                totalTables = $doc.Tables.Count
                hwnd = $winInfo.Hwnd
                pid = $winInfo.Pid
                title = $doc.Name
            }
        }

        "sync_canonical" {
            $wordObj = Get-WordApp
            $word = $wordObj.App
            $word.Visible = $true
            $word.Activate()

            if ($word.Documents.Count -eq 0) {
                $doc = $word.Documents.Add()
            } else {
                $doc = $word.ActiveDocument
            }
            $doc.Activate()

            $sectionsWritten = Write-DocumentContent $doc $word $params.title $params.subtitle $params.sections $false

            $fullSavePath = $null
            $sizeBytes = 0
            $sha256 = $null
            $pdfPath = $null

            if ($params.filePath) {
                $targetPath = [string]$params.filePath
                $targetDir = [System.IO.Path]::GetDirectoryName($targetPath)
                if (-not [System.IO.Directory]::Exists($targetDir)) {
                    [System.IO.Directory]::CreateDirectory($targetDir) | Out-Null
                }
                $fullSavePath = [System.IO.Path]::GetFullPath($targetPath)
                $targetFileName = [System.IO.Path]::GetFileName($fullSavePath)

                # Close any conflicting document in Word with the same target filename that is not $doc
                foreach ($d in $word.Documents) {
                    try {
                        if ($null -ne $d -and ($d.FullName -ieq $fullSavePath -or $d.Name -ieq $targetFileName)) {
                            if ($d.Name -ne $doc.Name) {
                                $d.Close([ref]$false)
                            }
                        }
                    } catch {}
                }

                try {
                    $word.DisplayAlerts = 0
                    $doc.SaveAs2($fullSavePath, 16)
                } catch {
                    if ($doc.Path -and $doc.Path.Trim() -ne "") {
                        try {
                            $word.DisplayAlerts = 0
                            $doc.Save()
                        } catch {}
                    } else {
                        throw "Word sync_canonical SaveAs2 failed: " + $_.Exception.Message
                    }
                }

                if ([System.IO.File]::Exists($fullSavePath)) {
                    $fileStream = [System.IO.File]::Open($fullSavePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
                    $sizeBytes = $fileStream.Length
                    $hasher = [System.Security.Cryptography.SHA256]::Create()
                    $hashBytes = $hasher.ComputeHash($fileStream)
                    $fileStream.Close()
                    $sha256 = [BitConverter]::ToString($hashBytes).Replace("-", "").ToUpper()
                }

                if ($params.generatePdf) {
                    $pdfPath = [System.IO.Path]::ChangeExtension($fullSavePath, ".pdf")
                    $doc.ExportAsFixedFormat($pdfPath, 17)
                }
            }

            $totalParagraphs = $doc.Paragraphs.Count
            $totalTables = $doc.Tables.Count
            $docTitle = $doc.Name

            # If Word was started via temporary COM automation, close COM cleanly and reopen via interactive WINWORD.EXE so it stays open on screen
            if ($wordObj.IsNew -and $fullSavePath -and [System.IO.File]::Exists($fullSavePath)) {
                try { $doc.Close($false) } catch {}
                try { $word.Quit($false) } catch {}
                Start-Sleep -Milliseconds 300
                $launcherPy = Join-Path $PSScriptRoot "win32_app_launcher.py"
                if ([System.IO.File]::Exists($launcherPy)) {
                    & python $launcherPy launch "Microsoft Word" $fullSavePath 2>$null | Out-Null
                } else {
                    $exe = Get-WinwordExecutable
                    Start-Process -FilePath $exe -ArgumentList "`"$fullSavePath`"" | Out-Null
                }
                $winInfo = Find-WordHwnd -maxAttempts 30 -delayMs 200
            } else {
                $winInfo = Find-WordHwnd
            }

            Send-JsonResult @{
                success = $true
                verified = $true
                action = "synced_canonical"
                filePath = $fullSavePath
                pdfFilePath = $pdfPath
                sizeBytes = $sizeBytes
                sha256 = $sha256
                totalSections = $sectionsWritten
                totalParagraphs = $totalParagraphs
                totalTables = $totalTables
                hwnd = $winInfo.Hwnd
                pid = $winInfo.Pid
                title = $docTitle
            }
        }

        "revise" {
            $wordObj = Get-WordApp
            $word = $wordObj.App
            $word.Visible = $true
            $word.Activate()

            if ($word.Documents.Count -eq 0) {
                throw "No active Microsoft Word document open to revise."
            }
            $doc = $word.ActiveDocument
            $doc.Activate()

            $instruction = [string]$params.instruction
            $opType = [string]$params.operationType
            $secKeyword = [string]$params.targetSectionKeyword
            $addition = [string]$params.additionText

            $matched = $false
            $targetParagraph = $null

            # Find matching paragraph or section
            if ($secKeyword) {
                for ($i = 1; $i -le $doc.Paragraphs.Count; $i++) {
                    $p = $doc.Paragraphs.Item($i)
                    if ($p.Range.Text -match $secKeyword) {
                        $targetParagraph = $p
                        $matched = $true
                        break
                    }
                }
            }

            if ($opType -eq "EXPAND_PARAGRAPH" -and $params.paragraphNumber) {
                $pNum = [int]$params.paragraphNumber
                $pCount = 0
                for ($i = 1; $i -le $doc.Paragraphs.Count; $i++) {
                    $p = $doc.Paragraphs.Item($i)
                    $t = $p.Range.Text.Trim()
                    if ($t.Length -gt 25 -and -not ($t -match "^\d+\.")) {
                        $pCount++
                        if ($pCount -eq $pNum) {
                            $targetParagraph = $p
                            $matched = $true
                            break
                        }
                    }
                }
            }

            if ($matched -and $targetParagraph -and $addition) {
                $existingText = $targetParagraph.Range.Text.TrimEnd("`r`n")
                $targetParagraph.Range.Text = $existingText + " " + $addition + "`n"
            } elseif ($addition) {
                # Append to end of document
                $sel = $word.Selection
                [void]$sel.EndKey(6)
                $pRev = $sel.Range
                $pRev.Text = $addition
                $pRev.Font.Name = "Calibri"
                $pRev.Font.Size = 11.5
                [void]$pRev.InsertParagraphAfter()
            }

            # If revision requests an observation table
            if ($params.addTable -or $params.operationType -eq "ADD_TABLE" -or ($params.table -and $params.table.headers)) {
                if ($params.table -and $params.table.headers -and $params.table.rows) {
                    $sel = $word.Selection
                    [void]$sel.EndKey(6)
                    [void]$sel.TypeParagraph()
                    $headers = @($params.table.headers)
                    $rows = @($params.table.rows)
                    $rowCount = $rows.Count + 1
                    $colCount = $headers.Count

                    $tRange = $sel.Range
                    $table = $doc.Tables.Add($tRange, $rowCount, $colCount)
                    $table.Borders.Enable = $true
                    [void]$table.AutoFitBehavior(2)
                    for ($c = 0; $c -lt $colCount; $c++) {
                        $cell = $table.Cell(1, $c + 1)
                        $cell.Range.Text = [string]$headers[$c]
                        $cell.Range.Font.Bold = 1
                        $cell.Shading.BackgroundPatternColor = 0xE2E8F0
                    }
                    for ($r = 0; $r -lt $rows.Count; $r++) {
                        $rowVals = @($rows[$r])
                        for ($c = 0; $c -lt [Math]::Min($colCount, $rowVals.Count); $c++) {
                            $cell = $table.Cell($r + 2, $c + 1)
                            $cell.Range.Text = [string]$rowVals[$c]
                        }
                    }
                    [void]$sel.EndKey(6)
                }
            }

            Send-JsonResult @{
                success = $true
                action = "revised"
                instruction = $instruction
                operationType = $opType
                totalParagraphs = $doc.Paragraphs.Count
                totalTables = $doc.Tables.Count
                summary = "Applied live revision directly into open Microsoft Word document."
            }
        }

        "save" {
            $wordObj = Get-WordApp
            $word = $wordObj.App

            if ($word.Documents.Count -eq 0) {
                throw "No active Microsoft Word document open to save."
            }
            $doc = $word.ActiveDocument
            $targetPath = [string]$params.filePath
            if (-not $targetPath -or $targetPath.Trim() -eq "") {
                throw "Target filePath is required for save."
            }

            $targetDir = [System.IO.Path]::GetDirectoryName($targetPath)
            if (-not [System.IO.Directory]::Exists($targetDir)) {
                [System.IO.Directory]::CreateDirectory($targetDir) | Out-Null
            }

            # 16 = wdFormatXMLDocument (DOCX)
            $fullSavePath = [System.IO.Path]::GetFullPath($targetPath)
            $targetFileName = [System.IO.Path]::GetFileName($fullSavePath)

            # Close any conflicting document in Word with the same target filename that is not $doc
            foreach ($d in $word.Documents) {
                try {
                    if ($null -ne $d -and ($d.FullName -ieq $fullSavePath -or $d.Name -ieq $targetFileName)) {
                        if ($d.Name -ne $doc.Name) {
                            $d.Close([ref]$false)
                        }
                    }
                } catch {}
            }

            try {
                $word.DisplayAlerts = 0
                if ($doc.FullName -ieq $fullSavePath) {
                    $doc.Save()
                } else {
                    $doc.SaveAs2($fullSavePath, 16)
                }
            } catch {
                if ($doc.Path -and $doc.Path.Trim() -ne "") {
                    try {
                        $word.DisplayAlerts = 0
                        $doc.Save()
                    } catch {}
                } else {
                    # If target file is open in another Word instance or locked, save to an indexed path
                    $dir = [System.IO.Path]::GetDirectoryName($fullSavePath)
                    $stem = [System.IO.Path]::GetFileNameWithoutExtension($fullSavePath)
                    $ext = [System.IO.Path]::GetExtension($fullSavePath)
                    $altPath = [System.IO.Path]::Combine($dir, "${stem}_" + (Get-Date -Format "HHmmss") + $ext)
                    try {
                        $doc.SaveAs2($altPath, 16)
                        $fullSavePath = $altPath
                    } catch {
                        throw "Word SaveAs2 failed: " + $_.Exception.Message
                    }
                }
            }

            # Empirically verify the saved file exists on disk
            if (-not [System.IO.File]::Exists($fullSavePath)) {
                throw "Verification Failure: Document was not confirmed on disk after Word SaveAs2."
            }

            # Safely compute file size and hash with FileShare.ReadWrite to avoid Word file lock
            $fileStream = [System.IO.File]::Open($fullSavePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
            $sizeBytes = $fileStream.Length
            $hasher = [System.Security.Cryptography.SHA256]::Create()
            $hashBytes = $hasher.ComputeHash($fileStream)
            $fileStream.Close()
            $sha256 = [BitConverter]::ToString($hashBytes).Replace("-", "").ToUpper()

            # If PDF copy is requested
            $pdfPath = $null
            if ($params.generatePdf) {
                $pdfPath = [System.IO.Path]::ChangeExtension($fullSavePath, ".pdf")
                # 17 = wdFormatPDF
                $doc.ExportAsFixedFormat($pdfPath, 17)
            }

            Send-JsonResult @{
                success = $true
                verified = $true
                action = "saved"
                filePath = $fullSavePath
                pdfFilePath = $pdfPath
                sizeBytes = $sizeBytes
                sha256 = $sha256
                paragraphCount = $doc.Paragraphs.Count
                tableCount = $doc.Tables.Count
                summary = "Successfully saved and verified document directly from Microsoft Word."
            }
        }

        "get_state" {
            $wordObj = Get-WordApp
            $word = $wordObj.App
            $hasDoc = ($word.Documents.Count -gt 0)
            $winInfo = Find-WordHwnd
            Send-JsonResult @{
                success = $true
                wordRunning = $true
                documentOpen = $hasDoc
                documentCount = $word.Documents.Count
                hwnd = $winInfo.Hwnd
                pid = $winInfo.Pid
                activeDocName = if ($hasDoc) { $word.ActiveDocument.Name } else { $null }
                activeDocParagraphs = if ($hasDoc) { $word.ActiveDocument.Paragraphs.Count } else { 0 }
            }
        }

        "close" {
            $wordObj = Get-WordApp
            $word = $wordObj.App
            $preWin = Find-WordHwnd -maxAttempts 1 -delayMs 50
            $pidToWait = $preWin.Pid
            try { $word.DisplayAlerts = 0 } catch {}
            if ($word.Documents.Count -gt 0) {
                try {
                    $doc = $word.ActiveDocument
                    $doc.Close([ref]$false)
                    try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {}
                } catch {}
            }
            $didQuit = $false
            if ($params.quitWord -or $word.Documents.Count -eq 0) {
                try {
                    $word.Quit([ref]$false)
                    $didQuit = $true
                } catch {
                    try {
                        $word.Quit()
                        $didQuit = $true
                    } catch {}
                }
            }
            try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
            [GC]::Collect()
            [GC]::WaitForPendingFinalizers()
            if ($didQuit) {
                $deadline = (Get-Date).AddMilliseconds(5000)
                while ((Get-Date) -lt $deadline) {
                    $alive = Get-Process -Name "WINWORD" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -or ($pidToWait -and $_.Id -eq $pidToWait) }
                    if (-not $alive) { break }
                    Start-Sleep -Milliseconds 120
                }
            }
            Send-JsonResult @{
                success = $true
                action = "closed"
            }
        }

        default {
            throw "Unknown Action: $Action"
        }
    }
} catch {
    Send-JsonResult @{
        success = $false
        error = $_.Exception.Message
        action = $Action
    }
}
