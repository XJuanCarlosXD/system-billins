// Wrapper CLI headless sobre la logica REAL de firma de la App Firma
// Digital oficial de la DGII (App Firma Digital.exe, en este mismo
// directorio, descargada de dgii.gov.do > Facturacion > Comprobantes
// Fiscales Electronicos e-CF > Herramientas Recomendadas). Invoca
// wfFirma.Services.SignServices.FirmarXml directo, sin abrir ninguna
// ventana - verificado 2026-08-31 que produce una firma criptografica
// (DigestValue/SignatureValue) byte-a-byte identica a la que genera la
// GUI manual, corriendo bajo Mono en Linux (Debian 13, sin X server).
//
// Compilar: mcs -r:"App Firma Digital.exe" -out:firmar.exe firmar_wrapper.cs
// Uso:      echo <clave> | mono firmar.exe <xmlSinFirmar> <certificado.p12> <xmlFirmado>
// La clave del certificado se lee por stdin (no por argv) para que no
// quede visible en la lista de procesos del host (/proc/<pid>/cmdline).
using System;
using wfFirma.Services;

class Firmar {
    static int Main(string[] args) {
        try {
            var xmlPath = args[0];
            var certPath = args[1];
            var outPath = args[2];
            var certPass = Console.In.ReadLine();
            var svc = SignServices.Current;
            var doc = svc.FirmarXml(xmlPath, certPath, certPass, false);
            doc.Save(outPath);
            Console.WriteLine("OK");
            return 0;
        } catch (Exception ex) {
            Console.Error.WriteLine("ERROR: " + ex.ToString());
            return 1;
        }
    }
}
