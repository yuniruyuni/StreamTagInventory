import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { TwitchAuthProvider } from "./TwitchAuth";

const root = document.getElementById("root");
if( root ) {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <TwitchAuthProvider>
                <div>
                    Hello, world
                </div>
            </TwitchAuthProvider>
        </React.StrictMode>
    );
}