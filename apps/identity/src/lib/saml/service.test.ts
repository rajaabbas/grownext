import { describe, expect, it } from "vitest";
import { SamlService } from "./service";

const TEST_SP_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHe3Adxpv8uKXu
XwJE9idh+NangNh4tW7x1YgnSUZXoqBYwygJyI072QtdgQXl3k5iADG7n2AFD+a
TzbO0MJdHj7FVGHvXZHzVvzJeYfijpiapqYh6gMPkTFogyXv3gZH/BqhGlymM4T
N7DbStO2Qd6hw2yYB9H9n1tFoZT3zh0+BTtPlqvGjufH6G+j6lJzi10BGSAdoo6
ZlLQYh0b07XHtcwC5w2Xn1HULICwhf66A1VpzwuNFuIBqmoeZaZX6mE6xPD58Ll
IwrKyYVJZZzKzbwQ6vurIWBLL8GMDIS9ZhDJW60F7uO3cu6UytzszbmWzxubUAN
2oyEVeSZAgMBAAECggEAApidS2sHPyU6hN3Wf9eKJeNEqXWiwxupCSvJzpuG1Hs
k7kYMva9n32CuWHa3gwxM/H2ymlk/wEYBLETymFcpnSUsctNk6heAQ7EzxKQEiC
hczHxVn9Yx8RJWb1x1oGf4bm/FYnGV8eK3opgDdGztqKqRR3YKHyCuXapnwXCfJ
LmObEWj1vDLteA94ppIqhzyapMI2vlA38nSxrdbidKdvUSsfx8bVsgcuyo6ed15
Tzw9uQWGWpZJYG1ChB+FAxo0xO+ogzAm8h1Hn0SI7RyhokW2N1DbStO2Qd6hw2y
0b07XHtcwC5w2Xn1HULICwhf66A1VpzwuNFuIBqmoeQaQKBgQDz/qWh05rq6Arl
V+vWXT14BMWrMUR3pvN8MPmMXxMvmP0xSg6u40qCMgfHdCqkfNNpJBWlAbIYW/W
R0wweAV/QXpVZl8vLwawx2UY8ailqXF/w83vGN9ofuUBev5nYeD1yfknhk+aoCA
uMhptipheAQ7EzxKQEiChczHxVn9YwKBgQCImDgLK1TKoPY1TGVtC6zqD2c/Ik2
AsktwVDqveufqdpypPn32n7Z1xXHrp236UMtYYV9zp1KimG++HjMATkUMlzUxrA
ezwAun1vDLteA94ppIqhzyapMI2vlA38nSxrdbidKdvUSsfx8bVsgcuyo6ed15T
zw9uQWGWpZJYG1ChBQKBgF8VQwWi4KFOeFHrgb3R04QLbTjaCj1eO0MJdHj7FVH
vXZHzVvzJeYfijpiapqYh6gMPkTFogyXv3gZH/BqhGlymM4TN7DbStO2Qd6hw2y
YB9H9n1tFoZT3zh0+BTtPlqvGjufH6G+j6lJzi10BGSAdoo6ZlLQYh0b07XHtcw
C5w2Xn1HULICwhf66ApAoGAGsLaDT+xr3aMcMBXNIN1qNbfXDnpa9eKJeNEqXWi
wxupCSvJzpuG1Hsk7kYMva9n32CuWHa3gwxM/H2ymlk/wEYBLETymFcpnSUsctN
k6heAQ7EzxKQEiChczHxVn9Yx8RJWb1x1oGf4bm/FYnGV8eK3opgDdGztqKqRR3
YKHyCuXapnwXCfJLmUCgYEAk12ugHgdGXNq35p3xNmPR9U1FVLtZL1NVr7Di5ur
N6byN1Nsx3Rp3XIan+FJxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1JpN96CBvs1+qsSV
qS+8CA0nVddOZXS6jttuPAoBs+K6TfGsDz3jHK5vVsQt1zAr72Xd1LSeX776BF3
nf6/Dr7guP5AnbcW2CZAgMBAAEC
-----END PRIVATE KEY-----`;

const TEST_SP_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDdTCCAl2gAwIBAgIUEc7kwh28ykVfoCEN0z7dxyzKkVUwgDQYJKoZIhvcNAQEL
BQAwbjELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0FyaXpvbmExEDAOBgNVBAcMB1Bo
ZWVuaXgxFjAUBgNVBAoMDUV4YW1wbGUgQ29tcGFueTEcMBoGA1UEAwwTZXhhbXBs
ZS5sb2NhbCBzcCBjYTAeFw0yNDAxMDEwMDAwMDBaFw0yOTAxMDEwMDAwMDBaMG4x
CzAJBgNVBAYTAlVTMRAwDgYDVQQIDAdBcml6b25hMRAwDgYDVQQHDAdQaG9lbml4
MRYwFAYDVQQKDA1FeGFtcGxlIENvbXBhbnkxHDAaBgNVBAMME2V4YW1wbGUubG9j
YWwgc3AgY2EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDHe3Adxpv8
uKXuXwJE9idh+NangNh4tW7x1YgnSUZXoqBYwygJyI072QtdgQXl3k5iADG7n2AF
D+aTzbO0MJdHj7FVGHvXZHzVvzJeYfijpiapqYh6gMPkTFogyXv3gZH/BqhGlymM
4TN7DbStO2Qd6hw2yYB9H9n1tFoZT3zh0+BTtPlqvGjufH6G+j6lJzi10BGSAdoo
6ZlLQYh0b07XHtcwC5w2Xn1HULICwhf66A1VpzwuNFuIBqmoeZaZX6mE6xPD58Ll
IwrKyYVJZZzKzbwQ6vurIWBLL8GMDIS9ZhDJW60F7uO3cu6UytzszbmWzxubUAN2
oyEVeSZAgMBAAGjUzBRMB0GA1UdDgQWBBSCpcJn/qdNqxabWWMwBLT/gRgh/jAfB
gNVHSMEGDAWgBSCpcJn/qdNqxabWWMwBLT/gRgh/jAPBgNVHRMBAf8EBTADAQH/
MA0GCSqGSIb3DQEBCwUAA4IBAQA3FZ3VAbwY/jGj33jjXNMTvEihQ/HVbUaz2Qmi
IZ6hO6PvxI6Bfq5lHppZArYdS4x+h0/pk3jfbQ3VIAtF+wNCz7L+G2kZZgwyXR0Y
JIUKGwEuITdSb9VjA36TObgGJE0E7E5Wdl66iRS0LlwM651c01qmPvvrLpzjAU6Y
ewsGQKzBSSMSmc5QwDFi1Cdm42Hcps225y7sY9qsK0kGugHgdGXNq35p3xNmPR9U
1FVLtZL1NVr7Di5urN6byN1Nsx3Rp3XIan+FJxuxMxDPZWS9Vyuk3F7S3w7Dnk3a
1JpN96CBvs1+qsSVqS+8CA0nVddOZXS6jttuPAoBs+K6TfGsDz3jHK5vVsQt1zAr
-----END CERTIFICATE-----`;

const SAMPLE_IDP_METADATA = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>MIIDdzCCAl+gAwIBAgIEbZySUzANBgkqhkiG9w0BAQUFADBzMQswCQYDVQQGEwJVUzEQMA4GA1UECBMHQXJpem9uYTEQMA4GA1UEBxMHU2NvdHRzZGFsZTEaMBgGA1UEChMRRXhhbXBsZSBDb3JwcmF0IENvLjEZMBcGA1UEAxMQRXhhbXBsZSBSb290IENBMB4XDTIwMTAxMTAwMDAwMFoXDTQwMTAwNjAwMDAwMFowczELMAkGA1UEBhMCVVMxEDAOBgNVBAgTB0FyaXpvbmExEDAOBgNVBAcTB1Njb3R0c2RhbGUxGjAYBgNVBAoTEUV4YW1wbGUgQ29ycHJhdCBDby4xGTAXBgNVBAMTEEV4YW1wbGUgUm9vdCBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANh0b07XHtcwZ5w2XcYfZcQ3VIAtF+wNCz7L+G2kZZgwyXR0YJIUKGwEuITdSb9VjA36TObgGJE0E7E5Wdl66iRS0LlwM651c01qmPvvrLpzjAU6YewsGQKzBSSMSmc5QwDFi1Cdm42Hcps225y7sY9qsK0kGugHgdGXNq35p3xNmPR9U1FVLtZL1NVr7Di5urN6byN1Nsx3Rp3XIan+FJxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1JpN96CBvs1+qsSVqS+8CA0nVddOZXS6jttuPAoBs+K6TfGsDz3jHK5vVsQt1zAr72Xd1LSeX776BF3nf6/Dr7guP5AnbcW2CYwiVdcCAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAfXSPo6e7/jT730cdpShUMpOWcZH/5LiCFYI8a9kaI0s5momkMumZ5qX6Ch12yvDqOiiMHDL/95B2S/bRMyCV2wE8p8nXl16rYPD6/COM24kTx5cDIeEJD7BqXc9E+u6KDAdAm8YGtS+wGGyRyvE4s46HoPazTA/gkGEXLMaLLq5yRvCNrI6VOGGAaHo9dZYkTfGZNVVRFl1kYyqS/fWznuaCG2l9VmOAXoJ1i8LojRxurx8WcN6i/K3PaY5E9O+V1YxDCEV4VpWw2X2gYdEx+kt1/3uzMdGII4XESyqCCpt5TR1+t0NenE2no0RvrRZtGJPD7W82dManIeZdw==</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso" />
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/slo" />
  </IDPSSODescriptor>
</EntityDescriptor>`;

describe("SamlService", () => {
  it("parses IdP metadata and extracts signing certificates", () => {
    const service = new SamlService({
      entityId: "https://sp.example.com/metadata",
      signingPrivateKey: TEST_SP_PRIVATE_KEY,
      signingCertificate: TEST_SP_CERTIFICATE
    });

    const parsed = service.parseIdentityProviderMetadata(SAMPLE_IDP_METADATA);
    expect(parsed.entityId).toBe("https://idp.example.com");
    expect(parsed.signingCertificates).toHaveLength(1);
    expect(parsed.singleSignOnService.location).toBe("https://idp.example.com/sso");
    expect(parsed.singleLogoutService?.location).toBe("https://idp.example.com/slo");
  });
});
