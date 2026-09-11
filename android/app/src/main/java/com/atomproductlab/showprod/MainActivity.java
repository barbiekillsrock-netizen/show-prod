package com.atomproductlab.showprod;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Usa Chrome WebView do sistema em vez do WebView embutido
        WebView.setWebContentsDebuggingEnabled(false);
        super.onCreate(savedInstanceState);
    }
}
