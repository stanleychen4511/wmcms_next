import App from "../App";
import { FloatingToastProvider } from "../components/FloatingToast";

export default function Home() {
    return (
        <FloatingToastProvider>
            <App />
        </FloatingToastProvider>
    );
}
