# Meals & Meal Categories

This section provides an overview of meal-related features in SparkyFitness.

---

## Suggested Meal Category Times

SparkyFitness dynamically suggests the appropriate meal category (e.g., Breakfast, Lunch, Dinner, Snacks, or custom categories) when you log food based on your current time of day.

### How Suggested Times Work
Each meal category can have a **Default Time** assigned to it:
- When you log food, the app finds the meal category whose `default_time` is the **latest time that is less than or equal to your current time** ($\le \text{now}$).
- Each meal category's default time defines the start of its window until the next scheduled meal.
- For example, if **Snacks** is set to `5:00 PM` (`17:00`) and **Dinner** is set to `7:00 PM` (`19:00`):
  - Logging food between `5:00 PM` and `6:59 PM` will automatically suggest **Snacks**.
  - Logging food at or after `7:00 PM` will automatically suggest **Dinner**.

### Customizing Default Times
You can customize the target start time for any meal category on both Web and Mobile:
- **Web**: Go to **Settings → Meal Categories** and edit the **Default Time** (`HH:MM`) for any category.
- **Mobile**: Go to **Settings → Food Settings → Suggested Meal Times** and adjust the target times (`HH:MM`).

### Deleting a Custom Meal Category
Custom meal categories can be deleted from **Settings → Meal Categories** on Web. System defaults (Breakfast, Lunch, Dinner, Snacks) cannot be deleted, only hidden.

If the category has never been used, it is removed immediately. If anything still references it, a dialog shows exactly what is affected — diary entries, logged meals, planned items, and meal plan template items — and offers two choices:

- **Move items and delete** — everything is reassigned to another meal category you pick. Nutrition values, dates, and times are preserved; only the category label changes, so daily totals stay the same. This is the recommended option.
- **Delete everything** — permanently removes those records along with their logged nutrition. This cannot be undone.

If someone you share your diary with has entries in that category, the delete is refused until those are cleared, since they are not yours to remove.

::: info
Prefer hiding a category (the eye icon) if you only want it out of your diary. Hiding keeps all history intact.
:::
---

## Custom Meals

Custom meals can be created and consist of previously added foods. That way, you can group foods together and don't have to add them one by one. An example of how this might look like is provided below:

Meal Management:
![image](https://github.com/user-attachments/assets/4d7cb5e2-d188-4915-b8d5-0f17bf1dad88)

Adding a meal:
![image](https://github.com/user-attachments/assets/827cc881-5472-461f-94e4-3f86023b58c1)

## Meal Plans

A meal plan lists foods and meals for each day of the week, between a start date and an optional end date. To repeat something every day, put it on all seven days. You can keep several plans active at once, for example one that always applies and another for a few weeks.

Each plan has an **Add to diary** choice (a switch on mobile):

* **I add them** (the default for new plans). The plan's items appear in the matching meal of the Diary, marked **Planned**. They are not part of that day's totals until you tap **Add to diary**, which logs the meal and every food in it. A planned item shows its calories, and its picture when the food or meal has one (a meal without one shows the first picture of the foods inside it), and **Add all** logs every planned item of a meal in one tap. Planned items stay on past days, so you can still add something you forgot to log. Use **Skip** to drop an item from just that day; it does not come back, even if you delete the entries you added. **Undo** appears after adding or skipping. If **Add all** stops part way, the message says how many were added and which one failed.
* **Automatically.** The plan writes its entries into your Diary ahead of time, as earlier versions did. Plans you made before this option existed keep working this way.

To fill the week quickly, plan one day, then use **Copy to…** (web) or **Copy to other days…** (mobile) to copy it onto the other days. Days that are still empty are ticked for you, so for a new plan it is one tap; a day that already has items says it will be replaced and stays unticked unless you pick it. **Undo** appears after copying.

Switching a plan from automatic to planned keeps today's entries exactly as they are and turns only the days after today into planned items. Changing a plan changes what is shown as planned straight away. Entries you already added from a plan are your own diary entries and are kept when you edit or delete the plan.
