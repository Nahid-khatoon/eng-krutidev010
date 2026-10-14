$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    Write-Host "Word version: $($word.Version)"
    $doc = $word.Documents.Add()
    $sel = $word.Selection
    
    # Run 1: with Kruti Dev font for both letters and dot
    $sel.Font.Name = "Kruti Dev 010"
    $sel.TypeText("th.vkj.")
    $sel.TypeParagraph()
    
    # Run 2: with Kruti Dev for letters and Times New Roman for dot
    $sel.Font.Name = "Kruti Dev 010"
    $sel.TypeText("th")
    $sel.Font.Name = "Times New Roman"
    $sel.TypeText(".")
    $sel.Font.Name = "Kruti Dev 010"
    $sel.TypeText("vkj")
    $sel.Font.Name = "Times New Roman"
    $sel.TypeText(".")
    $sel.TypeParagraph()
    
    Write-Host "Para 1 runs count: $($doc.Paragraphs.Item(1).Range.Characters.Count)"
    Write-Host "Para 1 text: $($doc.Paragraphs.Item(1).Range.Text.Trim())"
    Write-Host "Para 2 runs count: $($doc.Paragraphs.Item(2).Range.Characters.Count)"
    Write-Host "Para 2 text: $($doc.Paragraphs.Item(2).Range.Text.Trim())"
    
    $doc.Close([ref]$false)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
