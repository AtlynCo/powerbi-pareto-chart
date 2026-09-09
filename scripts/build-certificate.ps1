param([Parameter(Mandatory = $true)][string]$CertificateDirectory)
$ErrorActionPreference = 'Stop'
$password = [System.IO.File]::ReadAllText((Join-Path $CertificateDirectory 'PowerBICustomVisualTestPass.txt'))
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
try {
    $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
        'CN=localhost',
        $rsa,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddDays(7))
    try {
        $bytes = $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
        [System.IO.File]::WriteAllBytes((Join-Path $CertificateDirectory 'PowerBICustomVisualTest_public.pfx'), $bytes)
    } finally {
        $certificate.Dispose()
    }
} finally {
    $rsa.Dispose()
}
