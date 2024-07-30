import React from "react";
import ReactDOM from "react-dom/client";
import useSWR from "swr";
import "./index.css";
import { twitch } from "./fetcher";

import { TwitchAuthContext, TwitchAuthProvider } from "./TwitchAuth";

function MainScreen() {
    const token = React.useContext(TwitchAuthContext);

    const { data: users, isLoading, error } = useSWR(["https://api.twitch.tv/helix/users", token], twitch.get);

    if (isLoading) return <div>loading...</div>;
    if (error) return <div>failed to load</div>;

    return (
        <div>
            user: {users.data[0].display_name}
        </div>
    );
}


const root = document.getElementById("root");
if( root ) {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <TwitchAuthProvider>
                <MainScreen />
            </TwitchAuthProvider>
        </React.StrictMode>
    );
}