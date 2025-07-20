"use client";

import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/lib/firestore/user/read";
import { updateCarts } from "@/lib/firestore/user/write";
import { Button } from "@nextui-org/react";
import { useState } from "react";
import toast from "react-hot-toast";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useRouter } from "next/navigation";

export default function AddToCartButton({
  productId,
  selectedWeight,
  selectedFlavor,
  price,
  salePrice,
}) {
  const { user } = useAuth();
  const { data } = useUser({ uid: user?.uid });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // ✅ Log all props for debugging
  console.log("📦 AddToCartButton Props:");
  console.log("productId:", productId);
  console.log("selectedWeight:", selectedWeight);
  console.log("selectedFlavor:", selectedFlavor);
  console.log("price:", price);
  console.log("salePrice:", salePrice);

  const isAdded = data?.carts?.find(
    (item) =>
      item?.id === productId &&
      item?.weight === selectedWeight?.weight &&
      item?.flavor === selectedFlavor?.name
  );

const handleClick = async () => {
  setIsLoading(true);

  // ✅ Console log everything up front
  console.log("🔥 ADD TO CART CLICKED");
  console.log("productId:", productId);
  console.log("selectedWeight:", selectedWeight);
  console.log("selectedWeight.weight:", selectedWeight?.weight);
  console.log("selectedFlavor:", selectedFlavor);
  console.log("selectedFlavor.name:", selectedFlavor?.name);
  console.log("price:", price);
  console.log("salePrice:", salePrice);

  try {
    if (!user?.uid) {
      router.push("/login");
      throw new Error("Please Log In First!");
    }

    // ✅ Validate after logging
    if (
      !productId ||
      !selectedWeight?.weight ||
      !selectedFlavor?.name ||
      price === undefined ||
      salePrice === undefined
    ) {
      throw new Error("Incomplete product details. Cannot add to cart.");
    }

    const cartItem = {
      id: productId,
      quantity: 1,
      weight: selectedWeight.weight,
      flavor: selectedFlavor.name,
      price: price,
      salePrice: salePrice,
    };

    let newList;
    if (isAdded) {
      newList = data?.carts?.filter(
        (item) =>
          !(
            item?.id === productId &&
            item?.weight === selectedWeight?.weight &&
            item?.flavor === selectedFlavor?.name
          )
      );
    } else {
      newList = [...(data?.carts ?? []), cartItem];
    }

    await updateCarts({ list: newList, uid: user?.uid });
  } catch (error) {
    toast.error(error?.message || "Error updating cart");
  }

  setIsLoading(false);
};


  return (
    <Button
      isLoading={isLoading}
      isDisabled={isLoading}
      onClick={handleClick}
      variant="flat"
      isIconOnly
      size="sm"
    >
      {!isAdded && <AddShoppingCartIcon className="text-xs" />}
      {isAdded && <ShoppingCartIcon className="text-xs" />}
    </Button>
  );
}
